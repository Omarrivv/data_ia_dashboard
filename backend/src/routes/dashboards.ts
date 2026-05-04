import express from 'express';
import Joi from 'joi';
import { Project } from '../models/Project';
import { authenticate } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { geminiService } from '../services/geminiService';
import { ApiResponse, Widget, Dashboard } from '../types';
import { getProjectAccess, getShareTokenFromRequest } from '../middleware/projectAccess';

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(authenticate);

// Esquemas de validación
const updateWidgetSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid('chart', 'metric', 'table', 'text').required(),
  title: Joi.string().required(),
  description: Joi.string().optional(),
  config: Joi.object({
    chartType: Joi.string().valid('line', 'bar', 'pie', 'scatter', 'area').optional(),
    dataSource: Joi.string().required(),
    xAxis: Joi.string().optional(),
    yAxis: Joi.string().optional(),
    groupBy: Joi.string().optional(),
    aggregation: Joi.string().valid('sum', 'avg', 'count', 'min', 'max').optional(),
    filters: Joi.object().optional(),
    colors: Joi.array().items(Joi.string()).optional()
  }).required(),
  position: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required(),
    width: Joi.number().required(),
    height: Joi.number().required()
  }).required()
});

const updateDashboardSchema = Joi.object({
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  widgets: Joi.array().items(updateWidgetSchema).optional(),
  layout: Joi.object({
    columns: Joi.number().min(1).max(24).optional(),
    rowHeight: Joi.number().min(50).max(500).optional(),
    margin: Joi.array().items(Joi.number()).length(2).optional()
  }).optional()
});

/**
 * @route   GET /api/dashboards/:projectId
 * @desc    Obtener dashboard de un proyecto
 * @access  Private
 */
router.get('/:projectId', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findById(req.params.projectId);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'viewer', getShareTokenFromRequest(req));

  if (!project.dashboard) {
    throw createError('El proyecto no tiene dashboard generado', 404);
  }

  // Incluir datos de los datasets para las visualizaciones
  const dashboardWithData = {
    ...project.dashboard,
    datasets: project.datasets.map(ds => ({
      _id: ds._id,
      originalName: ds.originalName,
      metadata: ds.metadata,
      data: ds.data.slice(0, 100) // Limitar datos para performance
    }))
  };

  res.json({
    success: true,
    data: dashboardWithData
  });
}));

/**
 * @route   PUT /api/dashboards/:projectId
 * @desc    Actualizar dashboard de un proyecto
 * @access  Private
 */
router.put('/:projectId', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  // Validar datos de entrada
  const { error, value } = updateDashboardSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const project = await Project.findById(req.params.projectId);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'editor', getShareTokenFromRequest(req));

  if (!project.dashboard) {
    throw createError('El proyecto no tiene dashboard para actualizar', 404);
  }

  // Actualizar dashboard
  Object.assign(project.dashboard, value);
  await project.save();

  res.json({
    success: true,
    data: project.dashboard,
    message: 'Dashboard actualizado exitosamente'
  });
}));

/**
 * @route   POST /api/dashboards/:projectId/widgets
 * @desc    Agregar widget al dashboard
 * @access  Private
 */
router.post('/:projectId/widgets', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  // Validar datos de entrada
  const { error, value } = updateWidgetSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const project = await Project.findById(req.params.projectId);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'editor', getShareTokenFromRequest(req));

  if (!project.dashboard) {
    throw createError('El proyecto no tiene dashboard', 404);
  }

  // Verificar que el widget ID no exista
  const existingWidget = project.dashboard.widgets.find(w => w.id === value.id);
  if (existingWidget) {
    throw createError('Ya existe un widget con ese ID', 400);
  }

  // Agregar widget
  project.dashboard.widgets.push(value);
  await project.save();

  res.status(201).json({
    success: true,
    data: value,
    message: 'Widget agregado exitosamente'
  });
}));

/**
 * @route   PUT /api/dashboards/:projectId/widgets/:widgetId
 * @desc    Actualizar widget específico
 * @access  Private
 */
router.put('/:projectId/widgets/:widgetId', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  // Validar datos de entrada
  const { error, value } = updateWidgetSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const project = await Project.findById(req.params.projectId);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'editor', getShareTokenFromRequest(req));

  if (!project.dashboard) {
    throw createError('El proyecto no tiene dashboard', 404);
  }

  // Encontrar y actualizar widget
  const widgetIndex = project.dashboard.widgets.findIndex(w => w.id === req.params.widgetId);
  if (widgetIndex === -1) {
    throw createError('Widget no encontrado', 404);
  }

  project.dashboard.widgets[widgetIndex] = value;
  await project.save();

  res.json({
    success: true,
    data: value,
    message: 'Widget actualizado exitosamente'
  });
}));

/**
 * @route   DELETE /api/dashboards/:projectId/widgets/:widgetId
 * @desc    Eliminar widget del dashboard
 * @access  Private
 */
router.delete('/:projectId/widgets/:widgetId', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findById(req.params.projectId);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  // Only owners can delete widgets to prevent privilege escalation via shared links
  // `getProjectAccess` expects a ProjectSharePermission ('viewer'|'editor'),
  // so request at least 'editor' and then assert the returned accessMode is 'owner'.
  const access = getProjectAccess(project, req.user._id.toString(), 'editor', getShareTokenFromRequest(req));
  if (access.accessMode !== 'owner') {
    throw createError('Permisos insuficientes — se requiere ser owner para eliminar widgets', 403);
  }

  if (!project.dashboard) {
    throw createError('El proyecto no tiene dashboard', 404);
  }

  // Encontrar y eliminar widget
  const widgetIndex = project.dashboard.widgets.findIndex(w => w.id === req.params.widgetId);
  if (widgetIndex === -1) {
    throw createError('Widget no encontrado', 404);
  }

  project.dashboard.widgets.splice(widgetIndex, 1);
  await project.save();

  res.json({
    success: true,
    message: 'Widget eliminado exitosamente'
  });
}));

/**
 * @route   POST /api/dashboards/:projectId/regenerate
 * @desc    Regenerar dashboard con IA
 * @access  Private
 */
router.post('/:projectId/regenerate', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findById(req.params.projectId);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'editor', getShareTokenFromRequest(req));

  if (!project.datasets || project.datasets.length === 0) {
    throw createError('El proyecto no tiene datasets para generar dashboard', 400);
  }

  try {
    // Obtener recomendaciones de visualización para cada dataset
    const visualizationPromises = project.datasets.map(dataset => 
      geminiService.recommendVisualizations(dataset)
    );
    
    const allRecommendations = await Promise.all(visualizationPromises);
    const flatRecommendations = allRecommendations.flat();

    // Crear widgets basados en las recomendaciones
    const widgets: Widget[] = flatRecommendations.map((rec, index) => ({
      id: `widget-${Date.now()}-${index}`,
      type: rec.type as any,
      title: rec.title,
      description: rec.description,
      config: {
        chartType: rec.chartType as any,
        dataSource: project.datasets[0]._id.toString(),
        xAxis: rec.dataColumns[0],
        yAxis: rec.dataColumns[1],
        colors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316']
      },
      position: {
        x: (index % 2) * 6,
        y: Math.floor(index / 2) * 4,
        width: 6,
        height: 4
      }
    }));

    // Actualizar dashboard
    project.dashboard = {
      title: `Dashboard - ${project.name}`,
      description: `Dashboard regenerado automáticamente el ${new Date().toLocaleDateString()}`,
      widgets,
      layout: {
        columns: 12,
        rowHeight: 150,
        margin: [10, 10]
      },
      generatedAt: new Date()
    } as any;

    await project.save();

    res.json({
      success: true,
      data: project.dashboard,
      message: 'Dashboard regenerado exitosamente'
    });

  } catch (error) {
    console.error('Error regenerando dashboard:', error);
    throw createError('Error al regenerar dashboard con IA', 500);
  }
}));

/**
 * @route   GET /api/dashboards/:projectId/data/:datasetId
 * @desc    Obtener datos procesados para visualización
 * @access  Private
 */
router.get('/:projectId/data/:datasetId', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findById(req.params.projectId);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'viewer', getShareTokenFromRequest(req));

  const dataset = project.datasets.find(ds => ds._id.toString() === req.params.datasetId);
  if (!dataset) {
    throw createError('Dataset no encontrado', 404);
  }

  // Procesar datos según los parámetros de consulta
  const { groupBy, aggregation, limit } = req.query;
  let processedData = dataset.data;

  // Aplicar agrupación si se especifica
  if (groupBy && aggregation) {
    processedData = processDataForVisualization(
      dataset.data,
      groupBy as string,
      aggregation as string
    );
  }

  // Aplicar límite si se especifica
  if (limit) {
    const limitNum = parseInt(limit as string);
    processedData = processedData.slice(0, limitNum);
  }

  res.json({
    success: true,
    data: {
      data: processedData,
      metadata: dataset.metadata,
      originalName: dataset.originalName
    }
  });
}));

// Función auxiliar para procesar datos para visualización
function processDataForVisualization(data: any[], groupBy: string, aggregation: string): any[] {
  const grouped = data.reduce((acc, item) => {
    const key = item[groupBy];
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});

  return Object.entries(grouped).map(([key, values]) => {
    const valuesArray = values as any[];
    let aggregatedValue;
    
    switch (aggregation) {
      case 'count':
        aggregatedValue = valuesArray.length;
        break;
      case 'sum':
        aggregatedValue = valuesArray.reduce((sum, item) => {
          const numericValues = Object.values(item).filter(val => !isNaN(Number(val)));
          return sum + numericValues.reduce((a: any, b: any) => Number(a) + Number(b), 0);
        }, 0);
        break;
      case 'avg':
        const sum = valuesArray.reduce((sum, item) => {
          const numericValues = Object.values(item).filter(val => !isNaN(Number(val)));
          return sum + numericValues.reduce((a: any, b: any) => Number(a) + Number(b), 0);
        }, 0);
        aggregatedValue = sum / valuesArray.length;
        break;
      default:
        aggregatedValue = valuesArray.length;
    }

    return {
      [groupBy]: key,
      value: aggregatedValue,
      count: valuesArray.length
    };
  });
}

export default router;