'use strict';
/**
 * Jest setup — suppress console.error/warn noise in test output.
 * Real errors are still caught by test assertions.
 */

// Suppress console.error during tests (it's triggered by intentional error-path tests)
const originalError = console.error;
const originalWarn  = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn  = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn  = originalWarn;
});
