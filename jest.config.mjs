/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  /** List each test with ✓ / ✕ under its describe block */
  verbose: true,
  roots: ['<rootDir>/src'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  /**
   * @chainsafe/ssz ships ESM; ts-jest only handles .ts, so Babel is used for those deps' .js.
   * See babel.config.cjs
   */
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest',
  },
  /** Transform ESM deps under node_modules (e.g. @chainsafe/ssz) with babel-jest */
  transformIgnorePatterns: [],
  moduleNameMapper: {
    /**
     * pnpm + Jest: @chainsafe/ssz resolves persistent-merkle-tree from its package
     * directory; map to the single hoisted copy (must match ssz’s expected API, 1.2.x).
     */
    '^@chainsafe/persistent-merkle-tree$':
      '<rootDir>/node_modules/@chainsafe/persistent-merkle-tree/lib/index.js',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
