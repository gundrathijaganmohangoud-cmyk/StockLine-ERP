// Jest global teardown. globalSetup runs in its own process; the test worker
// exits via forceExit (see jest.config.js) which closes Prisma's engine, so
// there is nothing to clean up here beyond a log line.
module.exports = async function globalTeardown() {
  console.log('Test run finished.');
};
