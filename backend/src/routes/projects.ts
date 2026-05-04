import express from 'express';
import Joi from 'joi';
import { Project } from '../models/Project';
import { authenticate } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { geminiService } from '../services/geminiService';
import { runProjectAnalysis } from '../services/projectAnalysisService';
import { enqueueAnalysis } from '../services/jobQueueService';
import { recordAuditEvent } from '../services/auditService';
import { ApiResponse, CreateProjectRequest, UpdateProject, ProjectStatus, GeminiAnalysisResult, Widget, ProjectDomain, ProjectSharePermission } from '../types';
import { sanitizeTextInput } from '../utils/validation';
import { analysisLimiter } from '../middleware/rateLimiters';
import { getProjectAccess, getProjectSharingLink, getShareTokenFromRequest, ensureOwner } from '../middleware/projectAccess';
import crypto from 'crypto';
import { calculateReliabilityScore, syncReliabilityAlerts } from '../services/projectAlertService';

const router = express.Router();

const projectQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(1000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().min(1).max(100).optional(),
  status: Joi.string().valid(...Object.values(ProjectStatus)).optional()
}).options({ abortEarly: false, stripUnknown: true, convert: true });

// Aplicar autenticación a todas las rutas
router.use(authenticate);

// Esquemas de validación
const createProjectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required().messages({
    'string.min': 'El nombre del proyecto es requerido',
    'string.max': 'El nombre no puede exceder 200 caracteres',
    'any.required': 'El nombre del proyecto es requerido'
  }),
  description: Joi.string().trim().max(1000).allow('').default('').messages({
    'string.max': 'La descripción no puede exceder 1000 caracteres'
  }),
  domain: Joi.string().valid('sales', 'marketing', 'finance', 'operations', 'custom').default('sales')
}).options({ abortEarly: false, stripUnknown: true, convert: true });

const shareProjectSchema = Joi.object({
  enabled: Joi.boolean().required(),
  permission: Joi.string().valid('viewer', 'editor').default('viewer'),
  regenerateToken: Joi.boolean().default(false)
}).options({ abortEarly: false, stripUnknown: true, convert: true });

const updateProjectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().max(1000).allow('').optional()
}).min(1).options({ abortEarly: false, stripUnknown: true, convert: true });

const generateWidgetSchema = Joi.object({
  prompt: Joi.string().trim().min(10).max(1000).required()
}).options({ abortEarly: false, stripUnknown: true, convert: true });

const chatSchema = Joi.object({
  message: Joi.string().trim().min(1).max(1000).required(),
  widgetContext: Joi.object({
    widgetTitle: Joi.string().trim().min(1).max(200).required(),
    widgetDescription: Joi.string().trim().max(1000).allow(''),
    chartType: Joi.string().valid('line', 'bar', 'pie', 'scatter', 'area').required(),
    xKey: Joi.string().trim().min(1).max(100).required(),
    yKey: Joi.string().trim().min(1).max(100).required(),
    dataSample: Joi.array().max(50).required(),
  }).unknown(true).required(),
  conversationHistory: Joi.array().max(20).items(Joi.object({
    role: Joi.string().valid('user', 'ai').required(),
    text: Joi.string().trim().max(1000).required(),
  })).default([]),
}).options({ abortEarly: false, stripUnknown: true, convert: true });

/**
 * @route   GET /api/projects
 * @desc    Obtener todos los proyectos del usuario
 * @access  Private
 */
router.get('/', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const { error, value } = projectQuerySchema.validate(req.query);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { page, limit, search, status } = value;

  // Construir filtros
  const filters: any = { userId: req.user._id };
  
  if (search) {
    filters.$text = { $search: search };
  }
  
  if (status) {
    filters.status = status;
  }

  // Ejecutar consulta con paginación
  const skip = (page - 1) * limit;
  const [projects, total] = await Promise.all([
    Project.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Project.countDocuments(filters)
  ]);

  // Agregar estadísticas a cada proyecto
  const projectsWithStats = projects.map(project => ({
    ...project,
    stats: {
      totalDatasets: project.datasets?.length || 0,
      totalRows: project.datasets?.reduce((sum, ds) => sum + (ds.metadata?.rowCount || 0), 0) || 0,
      hasDocumentation: !!project.documentation,
      hasDashboard: !!project.dashboard
    }
  }));

  res.json({
    success: true,
    data: {
      projects: projectsWithStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @route   POST /api/projects
 * @desc    Crear nuevo proyecto
 * @access  Private
 */
router.post('/', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  // Validar datos de entrada
  const { error, value } = createProjectSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const sanitizedName = sanitizeTextInput(value.name, { maxLength: 200 });
  if (!sanitizedName) {
    throw createError('El nombre del proyecto es requerido', 400);
  }

  const sanitizedDescription = sanitizeTextInput(value.description || '', { maxLength: 1000, allowNewlines: true });

  // Crear proyecto
  const project = new Project({
    name: sanitizedName,
    description: sanitizedDescription,
    domain: value.domain || 'sales',
    userId: req.user._id,
    status: ProjectStatus.DRAFT,
    datasets: []
  });

  await project.save();

  recordAuditEvent({
    userId: req.user._id.toString(),
    action: 'project.create',
    resourceType: 'project',
    resourceId: project._id.toString(),
    metadata: { name: project.name },
    req,
  });

  res.status(201).json({
    success: true,
    data: project,
    message: 'Proyecto creado exitosamente'
  });
}));

/**
 * @route   GET /api/projects/:id
 * @desc    Obtener proyecto específico
 * @access  Private
 */
router.get('/:id', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  const access = getProjectAccess(project, req.user._id.toString(), 'viewer', getShareTokenFromRequest(req));

  // Agregar estadísticas
  const projectWithStats = {
    ...project.toJSON(),
    stats: project.getStats(),
    access: access.accessMode,
    shareLink: project.sharing?.enabled && project.sharing?.token && access.accessMode === 'owner'
      ? getProjectSharingLink(project._id.toString(), project.sharing.token)
      : undefined
  };

  res.json({
    success: true,
    data: projectWithStats
  });
}));

/**
 * @route   GET /api/projects/:id/share
 * @desc    Obtener configuración de compartición del proyecto
 * @access  Private
 */
router.get('/:id/share', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  const token = project.sharing?.token;
  res.json({
    success: true,
    data: {
      enabled: !!project.sharing?.enabled,
      permission: project.sharing?.permission || 'viewer',
      shareLink: project.sharing?.enabled && token ? getProjectSharingLink(project._id.toString(), token) : null,
      token: project.sharing?.enabled ? token : null,
    }
  });
}));

/**
 * @route   PUT /api/projects/:id/share
 * @desc    Crear o actualizar enlace compartido
 * @access  Private
 */
router.put('/:id/share', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const { error, value } = shareProjectSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  const nextToken = value.enabled
    ? (value.regenerateToken || !project.sharing?.token ? crypto.randomUUID() : project.sharing.token)
    : null;

  project.sharing = {
    enabled: value.enabled,
    token: nextToken,
    permission: value.permission || 'viewer',
    updatedAt: new Date(),
  } as any;

  await project.save();

  recordAuditEvent({
    userId: req.user._id.toString(),
    action: value.enabled ? 'project.share.enabled' : 'project.share.disabled',
    resourceType: 'project',
    resourceId: project._id.toString(),
    metadata: { permission: value.permission || 'viewer' },
    req,
  });

  res.json({
    success: true,
    data: {
      enabled: !!project.sharing?.enabled,
      permission: project.sharing?.permission || 'viewer',
      shareLink: project.sharing?.enabled && project.sharing?.token ? getProjectSharingLink(project._id.toString(), project.sharing.token) : null,
      token: project.sharing?.enabled ? project.sharing?.token : null,
    },
    message: value.enabled ? 'Enlace compartido creado' : 'Compartición desactivada'
  });
}));

/**
 * @route   PUT /api/projects/:id
 * @desc    Actualizar proyecto
 * @access  Private
 */
router.put('/:id', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  // Validar datos de entrada
  const { error, value } = updateProjectSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  if (value.name !== undefined) {
    const sanitizedName = sanitizeTextInput(value.name, { maxLength: 200 });
    if (!sanitizedName) {
      throw createError('El nombre del proyecto es requerido', 400);
    }
    value.name = sanitizedName;
  }

  if (value.description !== undefined) {
    value.description = sanitizeTextInput(value.description, { maxLength: 1000, allowNewlines: true });
  }

  const project = await Project.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    value,
    { new: true, runValidators: true }
  );

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  recordAuditEvent({
    userId: req.user._id.toString(),
    action: 'project.update',
    resourceType: 'project',
    resourceId: project._id.toString(),
    metadata: { fields: Object.keys(value) },
    req,
  });

  res.json({
    success: true,
    data: project,
    message: 'Proyecto actualizado exitosamente'
  });
}));

/**
 * @route   DELETE /api/projects/:id
 * @desc    Eliminar proyecto
 * @access  Private
 */
router.delete('/:id', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  recordAuditEvent({
    userId: req.user._id.toString(),
    action: 'project.delete',
    resourceType: 'project',
    resourceId: project._id.toString(),
    metadata: { name: project.name },
    req,
  });

  res.json({
    success: true,
    message: 'Proyecto eliminado exitosamente'
  });
}));

/**
 * @route   POST /api/projects/:id/analyze
 * @desc    Analizar proyecto con IA Gemini
 * @access  Private
 */
router.post('/:id/analyze', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'editor', getShareTokenFromRequest(req));

  if (!project.datasets || project.datasets.length === 0) {
    throw createError('El proyecto no tiene datasets para analizar', 400);
  }

  // Enqueue analysis job so it runs in a managed queue
  const job = await enqueueAnalysis(project._id.toString(), req.user._id.toString());

  recordAuditEvent({
    userId: req.user._id.toString(),
    action: 'project.analyze.queued',
    resourceType: 'project',
    resourceId: project._id.toString(),
    metadata: { jobId: job._id.toString() },
    req,
  });

  // Mark project status to analyzing so UI reflects queued work
  project.status = ProjectStatus.ANALYZING;
  await project.save();

  res.status(202).json({
    success: true,
    data: { jobId: job._id.toString() },
    message: 'Análisis encolado. Usa el jobId para consultar estado.'
  });
}));

/**
 * @route   GET /api/projects/:id/dashboard
 * @desc    Obtener dashboard del proyecto
 * @access  Private
 */
router.get('/:id/dashboard', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findById(req.params.id);

  if (!project) {
    console.log('⚠️ Proyecto no encontrado para dashboard:', req.params.id);
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'viewer', getShareTokenFromRequest(req));

  if (!project.dashboard) {
    console.log('⚠️ Dashboard no encontrado para proyecto:', req.params.id);
    console.log('🔍 Estado del proyecto:', {
      hasDatasets: project.datasets?.length > 0,
      status: project.status,
      hasDashboard: !!project.dashboard
    });
    throw createError('El proyecto no tiene dashboard generado', 404);
  }

  console.log('📊 Enviando dashboard al frontend:', {
    projectId: project._id,
    dashboardTitle: project.dashboard.title,
    widgetCount: project.dashboard.widgets?.length || 0,
    widgets: project.dashboard.widgets?.map((w: any) => ({ id: w.id, type: w.type, title: w.title })) || [],
    layout: project.dashboard.layout
  });

  res.json({
    success: true,
    data: {
      dashboard: project.dashboard,
      datasets: project.datasets
    }
  });
}));

/**
 * @route   GET /api/projects/:id/documentation
 * @desc    Obtener documentación del proyecto
 * @access  Private
 */
router.get('/:id/documentation', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'viewer', getShareTokenFromRequest(req));

  res.json({
    success: true,
    data: {
      documentation: project.documentation || 'No hay documentación disponible',
      isHtml: project.documentation?.startsWith('<!DOCTYPE html>') || false,
      generatedAt: project.updatedAt
    }
  });
}));

/**
 * @route   GET /api/projects/:id/reliability
 * @desc    Obtener métricas de confiabilidad técnica del proyecto
 * @access  Private
 */
router.get('/:id/reliability', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findById(req.params.id);
  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'viewer', getShareTokenFromRequest(req));

  const stats = project.getStats();
  const alertSnapshot = syncReliabilityAlerts(project, calculateReliabilityScore(project));
  if (alertSnapshot.changed) {
    await project.save();
  }

  const datasetsSummary = (project.datasets || []).map((ds: any) => ({
    id: ds._id,
    originalName: ds.originalName,
    rowCount: ds.metadata?.rowCount || 0,
    columnsCount: (ds.metadata?.columns || []).length,
    nullableColumns: (ds.metadata?.columns || []).filter((c: any) => !!c.nullable).length,
    uploadedAt: ds.uploadedAt,
  }));

  const reliabilityScore = alertSnapshot.score;

  const recommendedActions: string[] = [];
  if (!stats.totalDatasets) recommendedActions.push('Sube al menos un dataset para generar análisis');
  if (datasetsSummary.some((d: any) => d.rowCount === 0)) recommendedActions.push('Verifica que los datasets contengan filas válidas');
  if (!stats.hasDocumentation) recommendedActions.push('Genera la documentación del proyecto');
  if (!stats.hasDashboard) recommendedActions.push('Genera el dashboard con IA');

  res.json({
    success: true,
    data: {
      stats,
      datasets: datasetsSummary,
      reliabilityScore,
      alerts: alertSnapshot.alerts,
      activeAlerts: alertSnapshot.activeAlerts,
      recommendedActions,
      lastUpdated: project.updatedAt,
      status: project.status
    }
  });
}));

/**
 * @route   POST /api/projects/:id/generate-widget
 * @desc    Genera un widget personalizado usando IA a partir de un prompt del usuario
 * @access  Private
 */
router.post('/:id/generate-widget', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  getProjectAccess(project, req.user._id.toString(), 'editor', getShareTokenFromRequest(req));

  if (!project.datasets || project.datasets.length === 0) {
    throw createError('El proyecto no tiene datasets. Sube un archivo primero.', 400);
  }

  const { error, value } = generateWidgetSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const prompt = sanitizeTextInput(value.prompt, { maxLength: 1000, allowNewlines: true });
  if (!prompt) {
    throw createError('El prompt no puede estar vacío', 400);
  }

  const dataset = project.datasets[0];
  const columns = dataset.metadata?.columns || [];
  const existingTitles = (project.dashboard?.widgets || []).map((w: any) => w.title);

  const widgetConfig = await geminiService.generateCustomWidget(
    prompt,
    columns,
    dataset.originalName,
    existingTitles
  );

  const newWidget = {
    id: `custom-widget-${Date.now()}`,
    type: 'chart' as const,
    title: widgetConfig.title,
    description: widgetConfig.description,
    config: {
      chartType: widgetConfig.chartType as 'line' | 'bar' | 'pie' | 'scatter' | 'area',
      dataSource: dataset._id.toString(),
      xAxis: widgetConfig.xAxis,
      yAxis: widgetConfig.yAxis,
      colors: widgetConfig.colors,
    },
    position: {
      x: ((project.dashboard?.widgets?.length || 0) % 2) * 6,
      y: Math.floor((project.dashboard?.widgets?.length || 0) / 2) * 4,
      width: 6,
      height: 4,
    },
  };

  if (!project.dashboard) {
    project.dashboard = {
      title: `Dashboard - ${project.name}`,
      description: `Dashboard de ${project.name}`,
      widgets: [],
      layout: { columns: 12, rowHeight: 150, margin: [10, 10] },
      generatedAt: new Date(),
    } as any;
  }

  (project.dashboard.widgets as any[]).push(newWidget);
  await project.save();

  console.log('✅ Widget personalizado guardado:', { id: newWidget.id, title: newWidget.title });

  res.json({
    success: true,
    data: { widget: newWidget, project },
    message: 'Widget generado y guardado exitosamente',
  });
}));

/**
 * @route   POST /api/projects/:id/chat-general
 * @desc    Chatbot general sobre todo el proyecto y sus datasets
 * @access  Private
 */
router.post('/:id/chat-general', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) throw createError('Usuario no autenticado', 401);

  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) throw createError('Proyecto no encontrado', 404);

  const { message, conversationHistory = [] } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw createError('El mensaje no puede estar vacío', 400);
  }

  const datasets = (project.datasets || []).map(ds => ({
    name: ds.originalName,
    rowCount: ds.metadata?.rowCount || 0,
    columns: ds.metadata?.columns || [],
    sampleData: (ds.data || []).slice(0, 5),
  }));

  const reply = await geminiService.chatAboutProject(message.trim(), {
    projectName: project.name,
    projectDescription: project.description,
    datasets,
    conversationHistory,
  });

  res.json({ success: true, data: { reply } });
}));

/**
 * @route   POST /api/projects/:id/chat
 * @desc    Chatbot sobre un widget específico del dashboard
 * @access  Private
 */
router.post('/:id/chat', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const project = await Project.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  const { error, value } = chatSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const message = sanitizeTextInput(value.message, { maxLength: 1000, allowNewlines: true });
  if (!message) {
    throw createError('El mensaje no puede estar vacío', 400);
  }

  const widgetContext = {
    ...value.widgetContext,
    widgetTitle: sanitizeTextInput(value.widgetContext.widgetTitle, { maxLength: 200 }),
    widgetDescription: sanitizeTextInput(value.widgetContext.widgetDescription || '', { maxLength: 1000, allowNewlines: true }),
    xKey: sanitizeTextInput(value.widgetContext.xKey, { maxLength: 100 }),
    yKey: sanitizeTextInput(value.widgetContext.yKey, { maxLength: 100 }),
  };

  const conversationHistory = value.conversationHistory.map((entry) => ({
    ...entry,
    text: sanitizeTextInput(entry.text, { maxLength: 1000, allowNewlines: true }),
  }));

  const reply = await geminiService.chatAboutWidget(message.trim(), {
    projectName: project.name,
    ...widgetContext,
    conversationHistory,
  });

  res.json({
    success: true,
    data: { reply }
  });
}));

export default router;