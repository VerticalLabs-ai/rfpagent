export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/tests/**/*.test.+(ts|js)',
    '!**/tests/**/*.spec.+(ts|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      diagnostics: false
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(p-limit|p-retry|yocto-queue|nanoid|is-network-error|@mastra)/)'
  ],
  collectCoverageFrom: [
    'server/**/*.{ts,js}',
    'src/**/*.{ts,js}',
    '!server/**/*.d.ts',
    '!server/index.ts',
    '!**/node_modules/**',
    '!**/*.spec.ts',
    '!**/*.test.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/(.*)$': '<rootDir>/server/$1',
    '^nanoid$': '<rootDir>/tests/__mocks__/nanoid.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testTimeout: 30000
};