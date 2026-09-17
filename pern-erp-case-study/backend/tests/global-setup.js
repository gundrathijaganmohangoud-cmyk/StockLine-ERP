// Jest global setup: prepares the TEST database schema before the suite runs.
// Uses TEST_DATABASE_URL (falls back to DATABASE_URL with a loud warning so
// tests never silently run against an unknown database).
const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = async function globalSetup() {
  const testUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!testUrl) {
    console.error('Test setup failed: neither TEST_DATABASE_URL nor DATABASE_URL is set.');
    process.exit(1);
  }
  if (!process.env.TEST_DATABASE_URL) {
    console.warn(
      'WARNING: TEST_DATABASE_URL is not set; tests will run against DATABASE_URL. ' +
        'Create a dedicated test database (e.g. pern_erp_test) and set TEST_DATABASE_URL.'
    );
  }

  const backendDir = path.join(__dirname, '..');
  const env = Object.assign({}, process.env, { DATABASE_URL: testUrl });

  execSync('npx prisma generate', { cwd: backendDir, env: env, stdio: 'inherit' });

  execSync('npx prisma migrate deploy', { cwd: backendDir, env: env, stdio: 'inherit' });
};
