import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import { createDocumentFromStream } from '../../src/image-converter';
import rewire from 'rewire';

chai.use(chaiAsPromised);
chai.should();

const pdf = rewire('pdfjs-dist/legacy/build/pdf');
const stubGetDocument = sinon.stub();
pdf.__set__('getDocument', stubGetDocument);

console.log(pdf.getDocument)
describe('createDocumentFromStream', () => {
    
    // beforeEach(() => {
    //     // fakePdf = sinon.stub(pdf);
    //     fakePdf.get('getDocument');
    // })

    // afterEach(() => {
    //     fakePdf.getDocument.restore()
    // })

    // it('should create 500 http error if promise created by getDocument rejects', async () => {
    //     stubGetDocument.returns({
    //         docId: '123',
    //         promise: Promise.reject('bad'),
    //         destroy: () => 0,
    //         destroyed: false
    //     })
        
    //     return createDocumentFromStream('some-url').should.eventually.be.rejectedWith('HttpError');
    // });
    it('sanity', () => {
        expect(true).to.be.true;
    })
});
