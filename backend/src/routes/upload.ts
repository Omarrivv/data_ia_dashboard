import express from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import path from 'path';
import Joi from 'joi';
import { authenticate } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { Project } from '../models/Project';
import { ApiResponse, Dataset, ColumnInfo, DatasetMetadata } from '../types';
import { recordAuditEvent } from '../services/auditService';
import { isPlainObject, sanitizeFilename, validateDatasetRows, MAX_UPLOAD_ROWS } from '../utils/validation';
import { uploadLimiter } from '../middleware/rateLimiters';
import { getProjectAccess, getShareTokenFromRequest } from '../middleware/projectAccess';
import { syncReliabilityAlerts } from '../services/projectAlertService';

const router = express.Router();

// Almacenar archivo en RAM, nunca en disco
const storage = multer.memoryStorage();

const allowedFileTypes = [
  { mimetype: 'text/csv', extensions: ['.csv'] },
  { mimetype: 'application/json', extensions: ['.json'] },
  { mimetype: 'application/vnd.ms-excel', extensions: ['.xls'] },
  { mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensions: ['.xlsx'] },
];

const uploadParamsSchema = Joi.object({
  projectId: Joi.string().pattern(/^[a-fA-F0-9]{24}$/).required().messages({
    'string.pattern.base': 'ID de proyecto inválido',
    'any.required': 'ID de proyecto requerido'
  })
}).options({ abortEarly: false, stripUnknown: true, convert: true });

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const normalizedName = sanitizeFilename(file.originalname);
  const extension = path.extname(normalizedName).toLowerCase();
  const isAllowed = allowedFileTypes.some(({ mimetype, extensions }) =>
    mimetype === file.mimetype && extensions.includes(extension)
  );

  if (normalizedName.length === 0) {
    cb(createError('Nombre de archivo inválido', 400) as unknown as Error);
    return;
  }

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(createError('Solo se permiten archivos CSV, JSON y Excel con extensión válida', 400) as unknown as Error);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB por defecto
  }
});

// Aplicar autenticación a todas las rutas
router.use(authenticate);

/**
 * @route   POST /api/upload/:projectId
 * @desc    Subir archivo de datos a un proyecto
 * @access  Private
 */
router.post('/:projectId', uploadLimiter, upload.single('file'), asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const { error: paramError, value: params } = uploadParamsSchema.validate(req.params);
  if (paramError) {
    throw createError(paramError.details[0].message, 400);
  }

  if (!req.file) {
    throw createError('No se proporcionó ningún archivo', 400);
  }

  // Verificar que el proyecto existe y pertenece al usuario
  const project = await Project.findById(params.projectId);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'editor', getShareTokenFromRequest(req));

  // Procesar el archivo en memoria — nunca se guarda en disco
  const data = await processFile(req.file);
  const metadata = generateMetadata(data);
  const safeFilename = sanitizeFilename(req.file.originalname);

  // Crear dataset
  const dataset: Omit<Dataset, '_id'> = {
    filename: safeFilename,
    originalName: safeFilename,
    mimetype: req.file.mimetype,
    size: req.file.size,
    data: data.slice(0, 1000), // Limitar a 1000 registros para almacenamiento
    metadata,
    uploadedAt: new Date()
  };

  // Agregar dataset al proyecto
  project.datasets.push(dataset as any);
  syncReliabilityAlerts(project);
  await project.save();

  recordAuditEvent({
    userId: req.user._id.toString(),
    action: 'dataset.upload',
    resourceType: 'project',
    resourceId: project._id.toString(),
      metadata: { filename: safeFilename, size: req.file.size },
    req,
  });

  res.json({
    success: true,
    data: {
      dataset: {
        ...dataset,
        _id: project.datasets[project.datasets.length - 1]._id
      },
      project: {
        _id: project._id,
        name: project.name,
        totalDatasets: project.datasets.length
      }
    },
    message: 'Archivo subido y procesado exitosamente'
  });
}));

/**
 * @route   GET /api/upload/:projectId/datasets
 * @desc    Obtener todos los datasets de un proyecto
 * @access  Private
 */
router.get('/:projectId/datasets', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findOne({
    _id: req.params.projectId,
    userId: req.user._id
  }).select('datasets');

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  res.json({
    success: true,
    data: {
      datasets: project.datasets.map(dataset => ({
        _id: dataset._id,
        filename: dataset.filename,
        originalName: dataset.originalName,
        mimetype: dataset.mimetype,
        size: dataset.size,
        metadata: dataset.metadata,
        uploadedAt: dataset.uploadedAt,
        // No incluir los datos completos para optimizar la respuesta
        sampleData: dataset.data.slice(0, 5)
      }))
    }
  });
}));

/**
 * @route   GET /api/upload/:projectId/datasets/:datasetId
 * @desc    Obtener dataset específico con todos los datos
 * @access  Private
 */
router.get('/:projectId/datasets/:datasetId', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findOne({
    _id: req.params.projectId,
    userId: req.user._id
  });

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  const dataset = project.datasets.find(ds => ds._id.toString() === req.params.datasetId);
  if (!dataset) {
    throw createError('Dataset no encontrado', 404);
  }

  res.json({
    success: true,
    data: dataset
  });
}));

/**
 * @route   DELETE /api/upload/:projectId/datasets/:datasetId
 * @desc    Eliminar dataset de un proyecto
 * @access  Private
 */
router.delete('/:projectId/datasets/:datasetId', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findOne({
    _id: req.params.projectId,
    userId: req.user._id
  });

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  const datasetIndex = project.datasets.findIndex(ds => ds._id.toString() === req.params.datasetId);
  if (datasetIndex === -1) {
    throw createError('Dataset no encontrado', 404);
  }

  // Eliminar dataset del proyecto (solo en MongoDB, no hay archivo en disco)
  project.datasets.splice(datasetIndex, 1);
  await project.save();

  recordAuditEvent({
    userId: req.user._id.toString(),
    action: 'dataset.delete',
    resourceType: 'project',
    resourceId: project._id.toString(),
    metadata: { datasetId: req.params.datasetId },
    req,
  });

  res.json({
    success: true,
    message: 'Dataset eliminado exitosamente'
  });
}));

// Funciones auxiliares

/**
 * Procesa un archivo desde su buffer en memoria según su tipo
 */
async function processFile(file: Express.Multer.File): Promise<any[]> {
  const { buffer, mimetype } = file;

  try {
    switch (mimetype) {
      case 'text/csv':
        return await processCSV(buffer);

      case 'application/json':
        return await processJSON(buffer);

      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return await processExcel(buffer);

      default:
        throw new Error('Tipo de archivo no soportado');
    }
  } catch (error) {
    throw createError(`Error procesando archivo: ${(error as Error).message}`, 400);
  }
}

/**
 * Procesa CSV desde buffer
 */
function processCSV(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    let settled = false;
    const parser = csv();

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    parser.on('data', (data) => {
      if (settled) {
        return;
      }

      results.push(data);

      if (results.length > MAX_UPLOAD_ROWS) {
        parser.destroy(new Error(`El archivo excede el máximo de ${MAX_UPLOAD_ROWS} filas permitidas`));
        return;
      }

      try {
        validateDatasetRows([data]);
      } catch (validationError) {
        parser.destroy(validationError as Error);
      }
    });

    parser.on('error', (error) => fail(error));
    parser.on('end', () => {
      if (!settled) {
        settled = true;
        resolve(results);
      }
    });

    Readable.from(buffer).pipe(parser);
  });
}

/**
 * Procesa JSON desde buffer
 */
async function processJSON(buffer: Buffer): Promise<any[]> {
  let jsonData: unknown;

  try {
    jsonData = JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new Error('JSON inválido');
  }

  if (Array.isArray(jsonData)) {
    validateDatasetRows(jsonData);
    return jsonData;
  }

  if (isPlainObject(jsonData)) {
    validateDatasetRows([jsonData]);
    return [jsonData];
  }

  throw new Error('Formato JSON no válido');
}

/**
 * Procesa Excel desde buffer
 */
async function processExcel(buffer: Buffer): Promise<any[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet);
  validateDatasetRows(rows);
  return rows;
}

/**
 * Genera metadatos para un dataset
 */
function generateMetadata(data: any[]): DatasetMetadata {
  if (!data || data.length === 0) {
    return {
      columns: [],
      rowCount: 0,
      dataTypes: {},
      summary: 'Dataset vacío',
      insights: []
    };
  }

  const firstRow = data[0];
  const columns: ColumnInfo[] = [];
  const dataTypes: Record<string, string> = {};

  if (!isPlainObject(firstRow)) {
    throw new Error('El dataset debe contener objetos válidos');
  }

  // Analizar cada columna
  Object.keys(firstRow).forEach(columnName => {
    const columnValues = data.map(row => row[columnName]).filter(val => val !== null && val !== undefined);
    const type = inferDataType(columnValues);
    const unique = new Set(columnValues).size === columnValues.length;
    const nullable = columnValues.length < data.length;

    columns.push({
      name: columnName,
      type,
      nullable,
      unique,
      examples: columnValues.slice(0, 3)
    });

    dataTypes[columnName] = type;
  });

  return {
    columns,
    rowCount: data.length,
    dataTypes,
    summary: `Dataset con ${data.length} filas y ${columns.length} columnas`,
    insights: generateBasicInsights(data, columns)
  };
}

/**
 * Infiere el tipo de dato de una columna
 */
function inferDataType(values: any[]): 'string' | 'number' | 'date' | 'boolean' {
  if (values.length === 0) return 'string';

  const sample = values.slice(0, 100); // Muestra de 100 valores
  
  // Verificar si son números
  const numericCount = sample.filter(val => !isNaN(Number(val)) && val !== '').length;
  if (numericCount / sample.length > 0.8) {
    return 'number';
  }
  
  // Verificar si son fechas
  const dateCount = sample.filter(val => !isNaN(Date.parse(val))).length;
  if (dateCount / sample.length > 0.8) {
    return 'date';
  }
  
  // Verificar si son booleanos
  const booleanValues = ['true', 'false', '1', '0', 'yes', 'no', 'sí', 'no'];
  const booleanCount = sample.filter(val => 
    booleanValues.includes(String(val).toLowerCase())
  ).length;
  if (booleanCount / sample.length > 0.8) {
    return 'boolean';
  }
  
  return 'string';
}

/**
 * Genera insights básicos del dataset
 */
function generateBasicInsights(data: any[], columns: ColumnInfo[]): string[] {
  const insights: string[] = [];
  
  insights.push(`El dataset contiene ${data.length} registros`);
  insights.push(`Se identificaron ${columns.length} columnas`);
  
  const numericColumns = columns.filter(col => col.type === 'number');
  if (numericColumns.length > 0) {
    insights.push(`${numericColumns.length} columnas numéricas detectadas`);
  }
  
  const dateColumns = columns.filter(col => col.type === 'date');
  if (dateColumns.length > 0) {
    insights.push(`${dateColumns.length} columnas de fecha detectadas`);
  }
  
  const uniqueColumns = columns.filter(col => col.unique);
  if (uniqueColumns.length > 0) {
    insights.push(`${uniqueColumns.length} columnas con valores únicos`);
  }
  
  return insights;
}

export default router;