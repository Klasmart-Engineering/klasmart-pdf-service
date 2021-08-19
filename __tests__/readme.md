# Unit Testing
Unit testing is the smallest form of testing by which we write tests which cover the logic of individual units.  Units generally translates to single function calls. Unit tests could assert that given a specific input a specific output is expected (pure function). Unit tests can also cover existing state and the changes to state (side effects).  Unit tests should not cover other behavior that is external to the function, especially external stateful things.

When we want to test with external dependencies we are getting into integration testing or some other more extensive form of testing (for instance, end-to-end testing).

However, as our code is reliant on external dependencies we need a way to fake that behavior and replace it with something else.  This is the process of stubbing/mocking.

Should unit tests cover private functions? Generally this is no, because you don't have access to them in your tests and because they can be covered in the logic of the code that calls them. However, using tools like rewired we *can* get access to it, and testing private functions in isolation allows us to better modularize our tests - testing over simpler units.

Mocha (ts-mocha) - Test runner
chai (chai-as-promised) - assertion library
sinon - stubbing/mocking library
rewired - Powerful mocking/module rewiring library

Alternative for unit testing:
jest

For integration testing:
supertest