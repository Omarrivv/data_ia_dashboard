import express from 'express';
import Joi from 'joi';
import { Project } from '../models/Project';
import { authenticate } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { geminiService } from '../services/geminiService';
import { ApiResponse, CreateProjectRequest, UpdateProject, ProjectStatus, GeminiAnalysisResult, Widget } from '../types';

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(authenticate);

// Esquemas de validación
const createProjectSchema = Joi.object({
  name: Joi.string().min(1).max(200).required().messages({
    'string.min': 'El nombre del proyecto es requerido',
    'string.max': 'El nombre no puede exceder 200 caracteres',
    'any.required': 'El nombre del proyecto es requerido'
  }),
  description: Joi.string().max(1000).optional().messages({
    'string.max': 'La descripción no puede exceder 1000 caracteres'
  })
});

const updateProjectSchema = Joi.object({
  name: Joi.string().min(1).max(200).optional(),
  description: Joi.string().max(1000).optional()
});

/**
 * @route   GET /api/projects
 * @desc    Obtener todos los proyectos del usuario
 * @access  Private
 */
router.get('/', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  if (!req.user) {
    throw createError('Usuario no autenticado', 401);
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const status = req.query.status as ProjectStatus;

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

  const { name, description }: CreateProjectRequest = value;

  // Crear proyecto
  const project = new Project({
    name,
    description,
    userId: req.user._id,
    status: ProjectStatus.DRAFT,
    datasets: []
  });

  await project.save();

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

  const project = await Project.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  // Agregar estadísticas
  const projectWithStats = {
    ...project.toJSON(),
    stats: project.getStats()
  };

  res.json({
    success: true,
    data: projectWithStats
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

  const project = await Project.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    value,
    { new: true, runValidators: true }
  );

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

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

  const project = await Project.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

  if (!project.datasets || project.datasets.length === 0) {
    throw createError('El proyecto no tiene datasets para analizar', 400);
  }

  try {
    // Cambiar estado a analizando
    project.status = ProjectStatus.ANALYZING;
    await project.save();

    // Analizar cada dataset con Gemini
    const analysisResults: GeminiAnalysisResult[] = [];
    for (const dataset of project.datasets) {
      const analysis = await geminiService.analyzeDataset(dataset);
      analysisResults.push(analysis);
    }

    // Generar documentación del proyecto
    const documentation = await geminiService.generateDocumentation(
      project.datasets,
      project.name,
      project.description
    );

    // Actualizar proyecto con resultados
    // Límite alto para soportar documentación HTML completa
    const maxDocLength = 150000;
    project.documentation = documentation.length > maxDocLength
      ? documentation.substring(0, maxDocLength) + '\n</div></body></html>'
      : documentation;
    
    project.status = ProjectStatus.READY;
    
    // Crear dashboard básico basado en las recomendaciones
    console.log('📈 Generando dashboard...');
    
    if (analysisResults.length > 0) {
      const firstAnalysis = analysisResults[0];
      const validVisualizations = firstAnalysis.visualizations || [];
      
      console.log(`📉 Visualizaciones disponibles: ${validVisualizations.length}`);
      
      // Asegurar que siempre tengamos al menos 3 widgets
      const dashboardWidgets: Widget[] = [];
      
      // Añadir visualizaciones reales
      validVisualizations.forEach((viz, index) => {
        const firstColumn = project.datasets[0]?.metadata?.columns?.[0]?.name || 'categoria';
        const secondColumn = project.datasets[0]?.metadata?.columns?.[1]?.name || 'valor';
        
        dashboardWidgets.push({
          id: `widget-${index}`,
          type: 'chart' as const,
          title: viz.title || `Gráfico ${index + 1}`,
          description: viz.description || 'Visualización de datos',
          config: {
            chartType: (viz.chartType as 'line' | 'bar' | 'pie' | 'scatter' | 'area') || 'bar',
            dataSource: project.datasets[0]._id.toString(),
            xAxis: viz.dataColumns?.[0] || firstColumn,
            yAxis: viz.dataColumns?.[1] || secondColumn,
            colors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6']
          },
          position: {
            x: (index % 2) * 6,
            y: Math.floor(index / 2) * 4,
            width: 6,
            height: 4
          }
        });
      });
      
      // Si no hay suficientes widgets, añadir algunos por defecto
      if (dashboardWidgets.length < 2) {
        const defaultWidgets = [
          {
            id: 'widget-default-1',
            type: 'chart' as const,
            title: 'Vista General',
            description: 'Resumen de los datos principales',
            config: {
              chartType: 'bar' as const,
              dataSource: project.datasets[0]._id.toString(),
              xAxis: project.datasets[0]?.metadata?.columns?.[0]?.name || 'categoria',
              yAxis: project.datasets[0]?.metadata?.columns?.[1]?.name || 'valor',
              colors: ['#3B82F6', '#10B981', '#F59E0B']
            },
            position: { x: 0, y: 0, width: 6, height: 4 }
          },
          {
            id: 'widget-default-2',
            type: 'chart' as const,
            title: 'Tendencias',
            description: 'Patrones en los datos',
            config: {
              chartType: 'line' as const,
              dataSource: project.datasets[0]._id.toString(),
              xAxis: project.datasets[0]?.metadata?.columns?.[0]?.name || 'tiempo',
              yAxis: project.datasets[0]?.metadata?.columns?.[1]?.name || 'valor',
              colors: ['#EF4444', '#8B5CF6']
            },
            position: { x: 6, y: 0, width: 6, height: 4 }
          }
        ];
        
        // Añadir widgets por defecto hasta tener al menos 2
        defaultWidgets.forEach((widget, idx) => {
          if (dashboardWidgets.length < 2) {
            dashboardWidgets.push(widget);
          }
        });
      }
      
      project.dashboard = {
        title: `Dashboard - ${project.name}`,
        description: firstAnalysis.summary || `Dashboard interactivo para ${project.name}`,
        widgets: dashboardWidgets,
        layout: {
          columns: 12,
          rowHeight: 150,
          margin: [10, 10]
        },
        generatedAt: new Date()
      } as any;
      
      console.log(`✅ Dashboard generado con ${dashboardWidgets.length} widgets`);
      console.log('🚀 Widgets generados:', dashboardWidgets.map(w => ({ id: w.id, type: w.type, title: w.title })));
    } else {
      console.log('⚠️ No se encontraron resultados de análisis, generando dashboard básico...');
      
      // Dashboard de respaldo
      project.dashboard = {
        title: `Dashboard - ${project.name}`,
        description: `Dashboard básico para el proyecto ${project.name}`,
        widgets: [
          {
            id: 'fallback-widget-1',
            type: 'chart',
            title: 'Resumen de Datos',
            description: 'Vista general de la información disponible',
            config: {
              chartType: 'bar',
              dataSource: project.datasets[0]._id.toString(),
              xAxis: 'categoria',
              yAxis: 'valor',
              colors: ['#3B82F6']
            },
            position: { x: 0, y: 0, width: 12, height: 6 }
          }
        ],
        layout: {
          columns: 12,
          rowHeight: 150,
          margin: [10, 10]
        },
        generatedAt: new Date()
      } as any;
    }

    await project.save();
    console.log('📊 Dashboard guardado en MongoDB:', {
      projectId: project._id,
      dashboardTitle: project.dashboard?.title,
      widgetCount: project.dashboard?.widgets?.length || 0,
      hasLayout: !!project.dashboard?.layout
    });

    res.json({
      success: true,
      data: {
        project,
        analysis: analysisResults
      },
      message: 'Análisis completado exitosamente'
    });

  } catch (error) {
    // Cambiar estado a error si falla
    project.status = ProjectStatus.ERROR;
    await project.save();
    throw error;
  }
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

  const project = await Project.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!project) {
    console.log('⚠️ Proyecto no encontrado para dashboard:', req.params.id);
    throw createError('Proyecto no encontrado', 404);
  }

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

  const project = await Project.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!project) {
    throw createError('Proyecto no encontrado', 404);
  }

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
 * @route   POST /api/projects/:id/generate-widget
 * @desc    Genera un widget personalizado usando IA a partir de un prompt del usuario
 * @access  Private
 */
router.post('/:id/generate-widget', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
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

  if (!project.datasets || project.datasets.length === 0) {
    throw createError('El proyecto no tiene datasets. Sube un archivo primero.', 400);
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw createError('El prompt no puede estar vacío', 400);
  }

  const dataset = project.datasets[0];
  const columns = dataset.metadata?.columns || [];
  const existingTitles = (project.dashboard?.widgets || []).map((w: any) => w.title);

  const widgetConfig = await geminiService.generateCustomWidget(
    prompt.trim(),
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

  const { message, widgetContext, conversationHistory = [] } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw createError('El mensaje no puede estar vacío', 400);
  }

  if (!widgetContext) {
    throw createError('Contexto del widget requerido', 400);
  }

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