import path from 'path';

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;
const TAG_PATTERN = /<[^>]*>/g;
const SAFE_FILENAME_PATTERN = /[^a-zA-Z0-9._-]+/g;

// Removed row limit - accept unlimited rows
// export const MAX_UPLOAD_ROWS = 5000;
export const MAX_UPLOAD_COLUMNS = 200; // Increased from 100 to allow more columns
export const MAX_UPLOAD_CELL_LENGTH = 10000; // Increased from 5000

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const sanitizeTextInput = (
  value: string,
  options: {
    maxLength?: number;
    allowNewlines?: boolean;
  } = {}
): string => {
  const { maxLength, allowNewlines = false } = options;
  let sanitized = value.normalize('NFKC');

  if (allowNewlines) {
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    sanitized = sanitized.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ');
  } else {
    sanitized = sanitized.replace(CONTROL_CHARACTERS, ' ');
  }

  sanitized = sanitized.replace(TAG_PATTERN, '');

  if (allowNewlines) {
    sanitized = sanitized.replace(/[\t\f\v ]+/g, ' ');
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  } else {
    sanitized = sanitized.replace(/\s+/g, ' ');
  }

  sanitized = sanitized.trim();

  if (typeof maxLength === 'number' && maxLength > 0) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
};

export const sanitizeFilename = (filename: string, fallback = 'upload'): string => {
  const baseName = path.basename(filename || fallback).normalize('NFKC');
  const sanitized = baseName
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(SAFE_FILENAME_PATTERN, '_')
    .replace(/^[_\.\s-]+|[_\.\s-]+$/g, '')
    .slice(0, 120);

  return sanitized || fallback;
};

export const validateDatasetRows = (rows: unknown[]): void => {
  // No row limit - accept unlimited rows
  rows.forEach((row, rowIndex) => {
    if (!isPlainObject(row)) {
      throw new Error(`La fila ${rowIndex + 1} no contiene un objeto válido`);
    }

    const columns = Object.keys(row);
    if (columns.length > MAX_UPLOAD_COLUMNS) {
      throw new Error(`La fila ${rowIndex + 1} excede el máximo de ${MAX_UPLOAD_COLUMNS} columnas`);
    }

    for (const column of columns) {
      const cellValue = row[column];
      if (typeof cellValue === 'string' && cellValue.length > MAX_UPLOAD_CELL_LENGTH) {
        throw new Error(`La columna "${column}" supera el tamaño máximo permitido`);
      }

      if (Array.isArray(cellValue) && cellValue.length > MAX_UPLOAD_CELL_LENGTH) {
        throw new Error(`La columna "${column}" supera el tamaño máximo permitido`);
      }

      if (isPlainObject(cellValue) && Object.keys(cellValue).length > MAX_UPLOAD_COLUMNS) {
        throw new Error(`La columna "${column}" contiene demasiadas propiedades`);
      }
    }
  });
};
