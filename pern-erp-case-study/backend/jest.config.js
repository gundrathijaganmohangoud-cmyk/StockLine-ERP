module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  globalSetup: '<rootDir>/tests/global-setup.js',
  globalTeardown: '<rootDir>/tests/global-teardown.js',
  testTimeout: 30000,
  // Prisma keeps an engine thread open; the suite is runInBand, so exiting
  // forcibly after the last test is the pragmatic way to finish cleanly.
  forceExit: true,
  verbose: true,
};

