/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  passWithNoTests: true,
  watchman: false,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@app/(.*)$': '<rootDir>/app/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/modules/'],
  /** Enforce team minimum (see npm run test:coverage). Per-file gaps may still exist. */
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
