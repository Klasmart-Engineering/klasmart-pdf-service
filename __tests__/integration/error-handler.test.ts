import request from 'supertest';
import express, { NextFunction } from 'express';
import { errorHandler } from '../../src/util/error-handler';
import sinon from 'sinon';
import createError from 'http-errors';

const app = express();
const sandbox = sinon.createSandbox();
const stub = sandbox.stub();

// Create a stub that can be controlled to throw a variety of errors to be
// picked up by the errorHandler
app.use(async (request, response, next: NextFunction) => {
    try {
        await stub();
        response.sendStatus(200);
    } catch (err) {
        next(err);
    }
});

app.use(errorHandler);

describe('error-handler', () => {

    afterEach(() => {
        sandbox.restore();
    })

    const errors = [400, 401, 402, 403, 416, 500, 501, 502];

    describe('Should respond with status code set when erroring with an HttpError', async () => {
        errors.forEach(e => {
            it(''+e, async () => {
                const error = createError(e, `http-error-${e}`);
                stub.rejects(error);
                await request(app)
                    .get('/pdf/misc.pdf/view.html')
                    .expect(e);
            });
        });
    });

    describe('Should respond with status code set in status if statusCode is undefined when erroring with an HttpError', async () => {
        errors.forEach(e => {
            it(''+e, async () => {
                const error = createError(e, `http-error-${e}`);
                (error.statusCode as any) = undefined;
                stub.rejects(error);
                await request(app)
                    .get('/pdf/misc.pdf/view.html')
                    .expect(e);
            });
        });
    });

    describe('Should respond with status code when handling generic error with a status field', async () => {
        errors.forEach(e => {
            it(''+e, async () => {
                const error = new Error(`http-error-${e}`);
                (error as any).status = e;
                stub.rejects(error);
                await request(app)
                    .get('/pdf/misc.pdf/view.html')
                    .expect(e);
            });
        });
    });

    it('Should respond with 500 when handling a generic error with no status field', async () => {
        stub.rejects(new Error('some error'));
        await request(app)
            .get('/pdf/misc.pdf/view.html')
            .expect(500);
    });
});

