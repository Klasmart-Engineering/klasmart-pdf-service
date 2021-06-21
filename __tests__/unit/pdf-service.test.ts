import * as pdfService from '../../src/pdf-service';
import typeorm from 'typeorm';
import { MockManager } from '../util/MockManager';
import sinon from 'sinon';

const sandbox = sinon.createSandbox();

describe('pdf-service', () => {

    let fakeEntityManager: sinon.SinonStubbedInstance<typeorm.EntityManager>;
    const transactionMockImpl = async (fn: (args: any[]) => Promise<any>) => await fn(fakeEntityManager as any);

    let mockManager: any;

    beforeEach(() => {
        fakeEntityManager = sandbox.createStubInstance(typeorm.EntityManager);
        fakeEntityManager.transaction.callsFake(transactionMockImpl as any);
        mockManager = new MockManager('getManager', fakeEntityManager);        
    });

    afterEach(() => {
        sandbox.restore();
        mockManager.close();
    })

    describe('getPDFPages', () => {
        it('it should reject with 500 if findOne rejects', async () => {
            mockManager.findOne.rejects();

            await pdfService.getPDFPages(new URL('http://fake-url.com'))
                .should.eventually.be.rejectedWith('HttpError');
        });

        it('should return totalPages if findOne returns a truthy value', async () => {

        });

        it('should call initializeMetadata if findOne returns a falsy value and return pages from this', async () => {

        });
    })
})