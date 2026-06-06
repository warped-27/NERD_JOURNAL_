module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@noble/.*|zustand))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/legacy/'],
  // @noble/* packages export subpaths with explicit .js extension (ESM package.json exports map).
  // Jest's CommonJS resolver doesn't strip .js so we map bare → .js here.
  moduleNameMapper: {
    '^@noble/hashes/(.+)\\.js$':  '<rootDir>/node_modules/@noble/hashes/$1.js',
    '^@noble/hashes/([^.]+)$':    '<rootDir>/node_modules/@noble/hashes/$1.js',
    '^@noble/ciphers/(.+)\\.js$': '<rootDir>/node_modules/@noble/ciphers/$1.js',
    '^@noble/ciphers/([^.]+)$':   '<rootDir>/node_modules/@noble/ciphers/$1.js',
    // @testing-library/react-native resolves react-test-renderer as "test-renderer"
    '^test-renderer$': '<rootDir>/node_modules/react-test-renderer',
  },
};
