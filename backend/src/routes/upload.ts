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
import { DatasetChunk } from '../models/DatasetChunk';
import { ApiResponse, Dataset, ColumnInfo, DatasetMetadata } from '../types';
import { recordAuditEvent } from '../services/auditService';
import { isPlainObject, sanitizeFilename, validateDatasetRows } from '../utils/validation';
import { uploadLimiter } from '../middleware/rateLimiters';
import { getProjectAccess, getShareTokenFromRequest } from '../middleware/projectAccess';
import { syncReliabilityAlerts } from '../services/projectAlertService';
import { computeStats, DataStats, summarizeDataset, DEFAULT_CHUNK_CONFIG } from '../utils/dataProcessor';
import {
  validateCellSecurity,
  validateRowSecurity,
  validateDatasetMetadata,
  validateDatasetSecurity,
  DATASET_SECURITY_LIMITS
} from '../utils/datasetSecurity';

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
router.post('/:projectId', upload.single('file'), asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
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

  // Procesar archivo con streaming/chunking para grandes datasets
  const startTime = Date.now();
  const data = await processFile(req.file);
  const processingTime = Date.now() - startTime;
  
  // Aplicar validaciones de seguridad ANTES de procesar
  const securityCheck = await validateDatasetSecurity(data, req.file.originalname, req.file.mimetype);
  if (securityCheck.warnings.length > 0) {
    console.warn('[Security] Warnings in dataset:', securityCheck.warnings);
    // Log warnings pero no bloquear (solo información)
  }

  // Validar datos con sanitización de seguridad
  const sanitizedData = data.map((row, idx) => validateRowSecurity(row, idx));

  const stats = computeStats(sanitizedData);
  const safeFilename = sanitizeFilename(req.file.originalname);

  // Validar metadata del dataset
  validateDatasetMetadata(stats.rowCount, stats.columnCount, stats.estimatedSize);

  console.info(`[Upload] Processed ${stats.rowCount} rows in ${processingTime}ms`, {
    filename: safeFilename,
    rows: stats.rowCount,
    columns: stats.columnCount,
    estimatedSize: stats.estimatedSize,
    securityWarnings: securityCheck.warnings.length
  });

  // Crear dataset metadata (sin guardar todos los datos inline)
  const dataset: Omit<Dataset, '_id'> = {
    filename: safeFilename,
    originalName: safeFilename,
    mimetype: req.file.mimetype,
    size: req.file.size,
    data: sanitizedData.slice(0, 100), // Preview de 100 registros para UI
    metadata: {
      columns: Array.from(stats.columns.values()).map(col => ({
        name: col.name,
        type: col.type as any,
        nullable: col.nullable > 0,
        unique: col.unique > (stats.rowCount * 0.9),
        examples: col.examples
      })),
      rowCount: stats.rowCount,
      dataTypes: Object.fromEntries(
        Array.from(stats.columns.entries()).map(([k, v]) => [k, v.type])
      ),
      summary: `${stats.rowCount} filas, ${stats.columnCount} columnas`,
      insights: generateInsights(stats)
    },
    uploadedAt: new Date()
  };

  // Agregar dataset al proyecto
  project.datasets.push(dataset as any);
  await project.save();

  const datasetId = project.datasets[project.datasets.length - 1]._id;

  // Guardar TODOS los datos en chunks (async, no bloquear respuesta)
  const chunkCount = Math.ceil(sanitizedData.length / DATASET_SECURITY_LIMITS.CHUNK_SIZE);
  saveDatasetChunksAsync(
    datasetId,
    project._id,
    sanitizedData,
    chunkCount
  ).catch(error => {
    console.error('[Error] Saving chunks:', error);
  });

  syncReliabilityAlerts(project);
  await project.save();

  recordAuditEvent({
    userId: req.user._id.toString(),
    action: 'dataset.upload',
    resourceType: 'project',
    resourceId: project._id.toString(),
    metadata: {
      filename: safeFilename,
      size: req.file.size,
      rows: stats.rowCount,
      columns: stats.columnCount,
      processingTimeMs: processingTime,
      chunks: chunkCount,
      securityWarnings: securityCheck.warnings
    },
    req,
  });

  res.json({
    success: true,
    data: {
      dataset: {
        ...dataset,
        _id: datasetId
      },
      project: {
        _id: project._id,
        name: project.name,
        totalDatasets: project.datasets.length
      },
      notice: `Dataset con ${stats.rowCount} registros se está procesando en background`
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
 * @route   GET /api/upload/:projectId/datasets/:datasetId/data
 * @desc    Obtener datos del dataset desde chunks (con pagination)
 * @access  Private
 */
router.get('/:projectId/datasets/:datasetId/data', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
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

  const skip = Math.max(0, parseInt(req.query.skip as string) || 0);
  const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit as string) || 1000));

  // Obtener datos desde chunks
  const chunkedData = await getDataChunks(req.params.datasetId, skip, limit);

  res.json({
    success: true,
    data: {
      ...chunkedData,
      columns: dataset.metadata?.columns || [],
      info: `Mostrando ${chunkedData.data.length}/${chunkedData.total} registros`
    }
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

  // Eliminar chunks en background (async, no bloquear respuesta)
  deleteDatasetChunksAsync(req.params.datasetId).catch(error => {
    console.error('[Error] Deleting chunks:', error);
  });

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

/**
 * Guarda datos en chunks de forma asincrónica (no bloquea respuesta)
 */
async function saveDatasetChunksAsync(
  datasetId: any,
  projectId: any,
  data: any[],
  totalChunks: number
): Promise<void> {
  const CHUNK_SIZE = DATASET_SECURITY_LIMITS.CHUNK_SIZE;
  
  try {
    console.info(`[Chunks] Saving ${totalChunks} chunks for dataset ${datasetId}`);
    
    // Guardar chunks en batches de 10 para no sobrecargar BD
    for (let i = 0; i < totalChunks; i += 10) {
      const batchEnd = Math.min(i + 10, totalChunks);
      const batchChunks: any[] = [];

      for (let chunkIdx = i; chunkIdx < batchEnd; chunkIdx++) {
        const startRow = chunkIdx * CHUNK_SIZE;
        const endRow = Math.min(startRow + CHUNK_SIZE, data.length);
        const chunkData = data.slice(startRow, endRow);

        if (chunkData.length > 0) {
          batchChunks.push({
            datasetId,
            projectId,
            chunkIndex: chunkIdx,
            data: chunkData,
            rowStart: startRow,
            rowEnd: endRow,
            rowCount: chunkData.length
          });
        }
      }

      // Insertar batch de chunks
      await DatasetChunk.insertMany(batchChunks);
      console.info(`[Chunks] Saved chunks ${i}-${batchEnd - 1} for dataset ${datasetId}`);
    }

    console.info(`[Chunks] ✓ All ${totalChunks} chunks saved for dataset ${datasetId}`);
  } catch (error) {
    console.error('[Chunks] Error saving chunks:', error);
    // No lanzar error, solo loguear (ya respondimos al cliente)
  }
}

/**
 * Obtiene un rango de datos desde chunks (con pagination)
 */
async function getDataChunks(
  datasetId: string,
  skip: number = 0,
  limit: number = 1000
): Promise<{ data: any[]; total: number; skip: number; limit: number }> {
  const totalChunks = await DatasetChunk.countDocuments({ datasetId });
  
  if (totalChunks === 0) {
    return { data: [], total: 0, skip, limit };
  }

  // Calcular qué chunks necesitamos
  const CHUNK_SIZE = DATASET_SECURITY_LIMITS.CHUNK_SIZE;
  const skipChunk = Math.floor(skip / CHUNK_SIZE);
  const skipInChunk = skip % CHUNK_SIZE;
  const neededChunks = Math.ceil((skipInChunk + limit) / CHUNK_SIZE);

  // Obtener chunks
  const chunks = await DatasetChunk.find({
    datasetId,
    chunkIndex: { $gte: skipChunk, $lt: skipChunk + neededChunks }
  })
    .sort({ chunkIndex: 1 })
    .lean();

  // Unir datos y aplicar skip/limit
  const allData = chunks.flatMap(c => c.data);
  const result = allData.slice(skipInChunk, skipInChunk + limit);

  // Obtener total de filas
  const firstChunk = chunks[0];
  const lastChunk = chunks[chunks.length - 1];
  const total = lastChunk ? lastChunk.rowEnd : 0;

  return {
    data: result,
    total,
    skip,
    limit
  };
}

/**
 * Elimina todos los chunks de un dataset de forma asincrónica
 */
async function deleteDatasetChunksAsync(datasetId: string): Promise<void> {
  try {
    const result = await DatasetChunk.deleteMany({ datasetId });
    console.info(`[Chunks] Deleted ${result.deletedCount} chunks for dataset ${datasetId}`);
  } catch (error) {
    console.error('[Chunks] Error deleting chunks:', error);
  }
}

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
function generateInsights(stats: DataStats): string[] {
  const insights: string[] = [];

  // Detectar columnas con muchos nulos
  for (const [, col] of stats.columns) {
    const nullPercentage = (col.nullable / stats.rowCount) * 100;
    if (nullPercentage > 50) {
      insights.push(`Columna "${col.name}" tiene ${Math.round(nullPercentage)}% valores nulos`);
    }
  }

  // Detectar columnas con muchos valores únicos (posible ID)
  for (const [, col] of stats.columns) {
    const uniquePercentage = (col.unique / stats.rowCount) * 100;
    if (uniquePercentage > 95 && col.type === 'string') {
      insights.push(`Columna "${col.name}" parece ser un identificador (${col.unique} valores únicos)`);
    }
  }

  // Recomendación general
  if (stats.rowCount > 50000) {
    insights.push(`Dataset grande (${stats.rowCount} filas): análisis en chunks para mejor rendimiento`);
  }

  return insights.slice(0, 3); // Limitar a 3 insights
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

export default router;