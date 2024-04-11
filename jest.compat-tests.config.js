/** @type {import('jest').Config} */
module.exports = {
  testMatch: [
    '<rootDir>/compat-tests/fixtures/*/*.compat-test.ts',
    '<rootDir>/compat-tests/*.compat-test.ts',
  ],
  moduleNameMapper: {},
  modulePathIgnorePatterns: ['<rootDir>/compat-tests/verdaccio'],
  automock: false,
  // transform: {
  //   '^.+\\.tsx?$': [
  //     'esbuild-jest',
  //     {
  //       sourcemap: true,
  //     },
  //   ],
  //   '^.+\\.js$': [
  //     'esbuild-jest',
  //     {
  //       sourcemap: true,
  //     },
  //   ],
  // },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // these tests take a long time to run, because each of them either runs a full build of a package,
  // or tests the build on a browser using playwright
  testTimeout: 1000 * 60 * 2,
  transform: {
    '^.+\\.tsx?$': [
      'jest-esbuild',
      {
        sourcemap: true,
        supported: {
          'dynamic-import': false,
        },
      },
    ],
    '^.+\\.js$': [
      'jest-esbuild',
      {
        sourcemap: true,
        supported: {
          'dynamic-import': false,
        },
      },
    ],
  },
}
