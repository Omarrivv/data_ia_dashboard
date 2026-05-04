import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeFilename,
  sanitizeTextInput,
  validateDatasetRows,
} from '../src/utils/validation';

test('sanitizeTextInput removes html tags and control characters', () => {
  const value = sanitizeTextInput('  <b>Hello</b>\nworld\u0000  ', {
    maxLength: 100,
    allowNewlines: true,
  });

  assert.equal(value, 'Hello\nworld');
});

test('sanitizeFilename normalizes unsafe paths', () => {
  const value = sanitizeFilename('..\\..\\evil report.csv');

  assert.equal(value, 'evil_report.csv');
});

test('validateDatasetRows rejects oversized or invalid payloads', () => {
  assert.throws(() => validateDatasetRows([null]), /objeto válido/);
  assert.throws(() => validateDatasetRows([Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`c${index}`, index]))]), /100 columnas/);
  assert.throws(() => validateDatasetRows([ { note: 'x'.repeat(5001) } ]), /tamaño máximo/);
});
