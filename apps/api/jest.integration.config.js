/** Integration tests: real Postgres (TEST_DATABASE_URL), run serially. */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/test'],
  testRegex: '\\.int-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  globalSetup: '<rootDir>/test/global-setup.ts',
  testTimeout: 30_000,
};
