/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
    /** pnpm: resolve ssz’s peer from project root in Jest */
    '^@chainsafe/persistent-merkle-tree$':
      '<rootDir>/node_modules/@chainsafe/persistent-merkle-tree',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
