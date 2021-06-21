import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
chai.should();

describe('test', () => {
    it('sanity', () => {
        expect(true).to.equal(true);
    });
});
