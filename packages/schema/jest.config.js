/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Only *.test.ts files are tests; __tests__/support holds shared helpers.
  testMatch: ['**/__tests__/**/*.test.ts'],
};
