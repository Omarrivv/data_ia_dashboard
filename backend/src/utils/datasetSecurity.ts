import { createError } from '../middleware/errorHandler';
import sanitizeHtml from 'sanitize-html';

/**
 * Límites de seguridad para datasets
 */
export const DATASET_SECURITY_LIMITS = {
  MAX_ROWS: 1000000, // 1M filas máximo
  MAX_COLUMNS: 500, // 500 columnas máximo
  MAX_CELL_SIZE_KB: 1024, // 1MB por celda
  MAX_STRING_LENGTH: 1048576, // 1MB de string
  MAX_ARRAY_LENGTH: 100000, // Arrays máx 100k elementos
  CHUNK_SIZE: 5000, // 5000 registros por chunk
  SUSPICIOUS_FORMULA_PATTERNS: [
    /^=\s*(cmd|powershell|bash|sh)/i,
    /^=.*\bshell\b/i,
    /^=.*\beval\b/i,
    /^=.*\bexec\b/i
  ]
};

/**
 * Valida seguridad de un valor individual
 */
export function validateCellSecurity(value: any, columnName: string): any {
  if (value === null || value === undefined) return value;

  // Detectar fórmulas peligrosas
  if (typeof value === 'string' && value.startsWith('=')) {
    for (const pattern of DATASET_SECURITY_LIMITS.SUSPICIOUS_FORMULA_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error(`Fórmula sospechosa detectada en columna "${columnName}": ${value.substring(0, 50)}`);
      }
    }
  }

  // Validar tamaño de strings
  if (typeof value === 'string') {
    if (value.length > DATASET_SECURITY_LIMITS.MAX_STRING_LENGTH) {
      throw new Error(`String en columna "${columnName}" excede límite de ${DATASET_SECURITY_LIMITS.MAX_STRING_LENGTH} caracteres`);
    }
    // Sanitizar HTML/scripts en strings
    return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  }

  // Validar arrays
  if (Array.isArray(value)) {
    if (value.length > DATASET_SECURITY_LIMITS.MAX_ARRAY_LENGTH) {
      throw new Error(`Array en columna "${columnName}" excede límite de ${DATASET_SECURITY_LIMITS.MAX_ARRAY_LENGTH} elementos`);
    }
    return value.map((v, i) => validateCellSecurity(v, `${columnName}[${i}]`));
  }

  // Validar objetos
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length > 100) {
      throw new Error(`Objeto en columna "${columnName}" tiene demasiadas propiedades (${keys.length})`);
    }
    const sanitized: any = {};
    for (const key of keys) {
      sanitized[key] = validateCellSecurity(value[key], `${columnName}.${key}`);
    }
    return sanitized;
  }

  return value;
}

/**
 * Valida seguridad de una fila completa
 */
export function validateRowSecurity(row: any, rowIndex: number, schema: Map<string, string> | null = null): any {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error(`Fila ${rowIndex} tiene formato inválido (debe ser objeto)`);
  }

  const columns = Object.keys(row);
  if (columns.length > DATASET_SECURITY_LIMITS.MAX_COLUMNS) {
    throw new Error(`Fila ${rowIndex} excede máximo de ${DATASET_SECURITY_LIMITS.MAX_COLUMNS} columnas`);
  }

  const sanitizedRow: any = {};
  for (const column of columns) {
    // Validar nombre de columna (evitar injection)
    if (!/^[a-zA-Z0-9_\-\s.()]+$/.test(column)) {
      throw new Error(`Nombre de columna inválido en fila ${rowIndex}: "${column}"`);
    }

    // Validar tipo de dato si hay schema
    if (schema && schema.has(column)) {
      const expectedType = schema.get(column);
      const actualType = typeof row[column];
      
      if (row[column] !== null && expectedType === 'number' && actualType !== 'number') {
        throw new Error(`Tipo de dato incorrecto en fila ${rowIndex}, columna "${column}": esperado number, obtenido ${actualType}`);
      }
    }

    sanitizedRow[column] = validateCellSecurity(row[column], column);
  }

  return sanitizedRow;
}

/**
 * Valida metadata del dataset antes de procesamiento
 */
export function validateDatasetMetadata(
  rowCount: number,
  columnCount: number,
  estimatedSizeBytes: number
): void {
  if (rowCount > DATASET_SECURITY_LIMITS.MAX_ROWS) {
    throw new Error(`Dataset excede máximo de ${DATASET_SECURITY_LIMITS.MAX_ROWS} filas (tiene ${rowCount})`);
  }

  if (columnCount > DATASET_SECURITY_LIMITS.MAX_COLUMNS) {
    throw new Error(`Dataset excede máximo de ${DATASET_SECURITY_LIMITS.MAX_COLUMNS} columnas (tiene ${columnCount})`);
  }

  // Validar tamaño estimado (máx 500MB)
  const maxSizeBytes = 500 * 1024 * 1024;
  if (estimatedSizeBytes > maxSizeBytes) {
    throw new Error(`Dataset excede tamaño máximo de ${maxSizeBytes / 1024 / 1024}MB (estimado: ${estimatedSizeBytes / 1024 / 1024}MB)`);
  }
}

/**
 * Detecta columnas con contenido potencialmente malicioso
 */
export function detectMaliciousContent(data: any[], columnName: string): string[] {
  const warnings: string[] = [];
  const sampleSize = Math.min(100, data.length);

  for (let i = 0; i < sampleSize; i++) {
    const value = data[i]?.[columnName];
    if (typeof value !== 'string') continue;

    // Detectar scripts
    if (/<script|javascript:|onerror=|onclick=/i.test(value)) {
      warnings.push(`Posible script XSS detectado en columna "${columnName}" fila ${i}`);
      break;
    }

    // Detectar comandos SQL
    if (/(\bUNION\b|\bSELECT\b|\bDROP\b|\bDELETE\b|\bINSERT\b)/i.test(value)) {
      warnings.push(`Posible SQL injection detectado en columna "${columnName}" fila ${i}`);
      break;
    }

    // Detectar rutas de sistema
    if (/^(\/|C:\\|\/dev\/|\/etc\/)/i.test(value)) {
      warnings.push(`Posible ruta de sistema detectada en columna "${columnName}" fila ${i}`);
      break;
    }
  }

  return warnings;
}

/**
 * Valida seguridad completa antes de guardar
 */
export async function validateDatasetSecurity(
  data: any[],
  filename: string,
  mimetype: string
): Promise<{ isValid: boolean; warnings: string[] }> {
  const warnings: string[] = [];

  if (data.length === 0) {
    throw new Error('Dataset vacío');
  }

  // Validar estructura
  const firstRow = data[0];
  if (!firstRow || typeof firstRow !== 'object') {
    throw new Error('Formato de datos inválido');
  }

  const columns = Object.keys(firstRow);

  // Detectar contenido malicioso por columna
  for (const column of columns) {
    const maliciousWarnings = detectMaliciousContent(data, column);
    warnings.push(...maliciousWarnings);
  }

  // Validar Excel específicamente
  if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      mimetype === 'application/vnd.ms-excel') {
    // Verificar nombres sospechosos de sheets
    if (filename.includes('macro') || filename.includes('xlsm')) {
      warnings.push('Archivo Excel contiene extensión sospechosa (posible macro)');
    }
  }

  // Validar JSON específicamente
  if (mimetype === 'application/json') {
    for (const row of data) {
      if (typeof row === 'object' && row !== null) {
        const keys = Object.keys(row);
        const suspiciousKeys = keys.filter(k => 
          /^(__|\$|eval|exec|constructor|prototype)/i.test(k)
        );
        if (suspiciousKeys.length > 0) {
          warnings.push(`Propiedades sospechosas detectadas: ${suspiciousKeys.join(', ')}`);
          break;
        }
      }
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings
  };
}
