import Sinon from 'sinon';
import { Request, Response } from 'express';
import { expect } from 'chai';
import { contentLengthFilter } from '../../../src/middleware/content-length-filter';

describe('contentLengthFilter', () => {
    const sendStatusStub = Sinon.stub();
    const nextStub = Sinon.stub();
    let request: Request;
    let response: Response = {
        sendStatus: sendStatusStub,
        locals: {
            token: {
                id: 'test-id',
                email: 'test-email'
            }
        }
    } as unknown as Response;

    const configureRequest = (size: number) => {
        request = {
            headers: {
                'content-length': ``+size
            }
        } as unknown as Request;
    };

    beforeEach(() => {
        sendStatusStub.resetHistory();
        nextStub.resetHistory();
    });



    it('should return a function', () => {
        expect(contentLengthFilter({ maxLength: 1_000_000 })).to.be.instanceOf(Function);
    });

    const inputSizes: [number, number][] = [
        [100, 100_000_000],
        [0, 10],
        [1, 2],
        [572_729, 524_288_00]
    ];

    describe('should call next with no parameters when content-length of request is less than configured filter size', () => {
        inputSizes.forEach(([input, configured]) => {
            it(`${input}/${configured}`, () => {
                const testFunction = contentLengthFilter({ maxLength: configured });
                configureRequest(input);
                testFunction(request, response, nextStub);
                expect(sendStatusStub.calledOnce).to.be.false;
                expect(nextStub.calledOnce).to.be.true;
            });
        });
    });

    describe('should call next with no parameters when content-length of request equal to the configured filter size', () => {
        const testFunction = contentLengthFilter({ maxLength: 1_000_000 });
        configureRequest(1_000_000);
        testFunction(request, response, nextStub);
        expect(sendStatusStub.calledOnce).to.be.false;
        expect(nextStub.calledOnce).to.be.true;
    });

    describe('should call sendStatus with 413 when content-length of request is greater than configured filter size', () => {
        inputSizes.forEach(([configured, input]) => {
            it(`${input}/${configured}`, () => {
                const testFunction = contentLengthFilter({ maxLength: configured });
                configureRequest(input);
                testFunction(request, response, nextStub);
                expect(nextStub.calledOnce).to.be.false;
                expect(sendStatusStub.calledOnce).to.be.true;
                expect(sendStatusStub.firstCall.firstArg).to.equal(413);
            });
        });
    });

    it('should treat content-length as 0 when content-length is undefined', () => {
        let testFunction = contentLengthFilter({ maxLength: 0 });
        request =  {
            headers: {
                'content-length': undefined
            }
        } as unknown as Request;
        testFunction(request, response, nextStub);
        expect(sendStatusStub.calledOnce).to.be.false;
        expect(nextStub.calledOnce).to.be.true;

        testFunction = contentLengthFilter({ maxLength: -1 });
        testFunction(request, response, nextStub);
        expect(sendStatusStub.calledOnce).to.be.true;
    });
});
