import { expect } from 'chai';
import { Request, Response } from 'express';
import fs from 'fs';
import Sinon from 'sinon';
import { cleanupTempFile } from '../../../src/middleware/temp-file-cleanup';

describe('temp-file-cleanup', () => {
    const sandbox = Sinon.createSandbox();
    const rmStub = sandbox.stub();
    const nextStub = sandbox.stub();

    sandbox.stub(fs, 'promises').value({ rm: rmStub })
    const testFunction = cleanupTempFile();

    const request = {} as unknown as Request;
    let response: Response;

    beforeEach(() => {
        sandbox.reset();
        response = {
            locals: { }
        } as unknown as Response;
    });

    it('should return a function', () => {
        expect(cleanupTempFile()).to.be.instanceOf(Function);        
    });

    it('should not call fs.promises.rm when tempFiles is undefined', async () => {
        await testFunction(request, response, nextStub);
        expect(rmStub.notCalled).to.be.true;
        expect(nextStub.calledOnce).to.be.true;
    });

    it('should call fs.promises.rm once when response.locals.tempFiles is a single string', async () => {
        const filename = 'somefile.txt';
        response.locals.tempFiles = filename;
        await testFunction(request, response, nextStub);
        expect(rmStub.calledOnce, 'Passing a string should call rmStub exactly once').to.be.true
        expect(rmStub.calledOnceWithExactly(filename), 'Method should attempt to delete file with same name as temp file').to.be.true;
        expect(nextStub.calledOnce).to.be.true;
    });

    it('should complete normally when a single string is passed but rm throws an error', async () => {
        const filename = 'some-error-causing-file.txt';
        response.locals.tempFiles = filename;
        nextStub.rejects(new Error('test-error'));
        await testFunction(request, response, nextStub);
        expect(rmStub.calledOnce, 'Passing a string should call rmStub exactly once').to.be.true;
        expect(rmStub.calledOnceWithExactly(filename), 'Method should attempt to delete file with same name as temp file').to.be.true;
        expect(nextStub.calledOnce).to.be.true;
    })

    it('should call fs.promises.rm on all files when tempFiles is an array', async () => {
        const files = ['a.txt', 'b.txt', 'c.txt'];
        response.locals.tempFiles = files;
        await testFunction(request, response, nextStub);
        expect(rmStub.getCalls().length).to.equal(files.length);
        expect(rmStub.getCalls()
            .map(call => call.firstArg)
        ).to.have.same.members(files);
        expect(nextStub.calledOnce).to.be.true;
    });

})