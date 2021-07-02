import * as typeorm from 'typeorm';
import { createSandbox, SinonSandbox } from 'sinon';

export class MockManager {
  sandbox: SinonSandbox;

  constructor (method: string | any, fakeData: any, args?: any) {
    this.sandbox = createSandbox();

    if (args) {
      this.sandbox.stub(typeorm, method).withArgs(args).returns(fakeData);
    } else {
      this.sandbox.stub(typeorm, method).returns(fakeData);
    }
  }

  close(): void {
    this.sandbox.restore();
  }
}
