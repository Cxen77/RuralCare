/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  testPathIgnorePatterns: ['<rootDir>/server/'],
  moduleNameMapper: {
    '^(.+)\\.(png|jpe?g|svg)$': 'ts-jest/mock-transform',
    '^(.+)\\.(webm|mp4|mov|ogg)$': 'ts-jest/mock-transform',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};