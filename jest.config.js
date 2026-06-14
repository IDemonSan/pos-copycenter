module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-safe-area-context|@react-native-async-storage/async-storage)',
  ],
  moduleNameMapper: {
    '^expo-haptics$': '<rootDir>/src/__mocks__/expo-haptics.js',
    '^expo-sqlite$': '<rootDir>/src/__mocks__/expo-sqlite.js',
  },
};
