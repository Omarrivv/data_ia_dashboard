import { Project } from '../models/Project';
import { DatasetChunk } from '../models/DatasetChunk';
import { ProjectStatus, GeminiAnalysisResult, Widget, ProjectDomain } from '../types';
import { geminiService } from './geminiService';
import { sanitizeHtmlContent } from '../utils/security';
import { syncReliabilityAlerts } from './projectAlertService';

/**
 * Carga todos los chunks de un dataset desde MongoDB y devuelve el array completo de filas.
 * Si no hay chunks guardados (aún procesándose o dataset pequeño), devuelve los datos inline.
 */
async function loadFullDatasetData(datasetId: string, inlineData: any[]): Promise<any[]> {
  const chunkCount = await DatasetChunk.countDocuments({ datasetId });
  if (chunkCount === 0) {
    // Sin chunks: usar datos inline (dataset pequeño o chunks aún no guardados)
    return inlineData;
  }
  const chunks = await DatasetChunk.find({ datasetId })
    .sort({ chunkIndex: 1 })
    .lean();
  const fullData = chunks.flatMap((c: any) => c.data);
  console.info(`[Analysis] Dataset ${datasetId}: cargadas ${fullData.length} filas desde ${chunkCount} chunks`);
  return fullData;
}

const MAX_DOCUMENTATION_LENGTH = 150000;

function getDomainTemplate(domain?: ProjectDomain) {
  switch (domain) {
    case 'marketing':
      return {
        title: 'Dashboard de Marketing',
        description: 'Seguimiento de adquisición, rendimiento de campañas y conversión.',
        widgets: [
          { title: 'Canales de adquisición', description: 'Comparación por canal principal', chartType: 'bar' as const },
          { title: 'Conversión en el tiempo', description: 'Tendencia de conversiones y resultados', chartType: 'line' as const },
          { title: 'Distribución por campaña', description: 'Peso relativo de campañas activas', chartType: 'pie' as const },
        ]
      };
    case 'finance':
      return {
        title: 'Dashboard Financiero',
        description: 'Visión de ingresos, costos, margen y liquidez.',
        widgets: [
          { title: 'Ingresos vs costos', description: 'Balance general del negocio', chartType: 'bar' as const },
          { title: 'Flujo temporal', description: 'Evolución de métricas financieras', chartType: 'line' as const },
          { title: 'Composición de gastos', description: 'Distribución de rubros financieros', chartType: 'pie' as const },
        ]
      };
    case 'operations':
      return {
        title: 'Dashboard Operativo',
        description: 'Estado de procesos, eficiencia y tiempos de respuesta.',
        widgets: [
          { title: 'Volumen operativo', description: 'Carga y throughput por periodo', chartType: 'bar' as const },
          { title: 'Tiempos de ciclo', description: 'Evolución de tiempos clave', chartType: 'line' as const },
          { title: 'Puntos de fricción', description: 'Distribución de incidencias', chartType: 'pie' as const },
        ]
      };
    case 'sales':
    default:
      return {
        title: 'Dashboard Comercial',
        description: 'Seguimiento de ingresos, conversión y desempeño comercial.',
        widgets: [
          { title: 'Ventas por segmento', description: 'Comparación de desempeño comercial', chartType: 'bar' as const },
          { title: 'Tendencia de ingresos', description: 'Evolución de ingresos en el tiempo', chartType: 'line' as const },
          { title: 'Mix de productos', description: 'Peso relativo por categoría', chartType: 'pie' as const },
        ]
      };
  }
}

function buildDomainWidgets(project: any): Widget[] {
  const template = getDomainTemplate(project.domain);
  const dataSource = project.datasets[0]?._id?.toString() || '';
  const xAxis = project.datasets[0]?.metadata?.columns?.[0]?.name || 'categoria';
  const yAxis = project.datasets[0]?.metadata?.columns?.[1]?.name || 'valor';

  return template.widgets.map((widget, index) => ({
    id: `domain-widget-${project.domain || 'sales'}-${index}`,
    type: 'chart',
    title: widget.title,
    description: widget.description,
    config: {
      chartType: widget.chartType,
      dataSource,
      xAxis,
      yAxis,
      colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
    },
    position: {
      x: (index % 2) * 6,
      y: Math.floor(index / 2) * 4,
      width: 6,
      height: 4
    }
  }));
}

export async function runProjectAnalysis(projectId: string, userId: string, progressUpdater?: (pct: number, msg?: string) => Promise<void>): Promise<void> {
  const project = await Project.findOne({ _id: projectId, userId });

  if (!project) {
    throw new Error('Proyecto no encontrado');
  }

  if (!project.datasets || project.datasets.length === 0) {
    throw new Error('El proyecto no tiene datasets para analizar');
  }

  try {
    project.status = ProjectStatus.ANALYZING;
    await project.save();
    if (progressUpdater) await progressUpdater(5, 'Proyecto marcado como analyzing');

    const analysisResults: GeminiAnalysisResult[] = [];
    for (let i = 0; i < project.datasets.length; i++) {
      const dataset = project.datasets[i];

      // Cargar el 100% de los datos desde DatasetChunk antes de analizar.
      // dataset.data solo tiene el preview de 100 filas guardado en el Project document.
      const fullData = await loadFullDatasetData(
        dataset._id.toString(),
        dataset.data
      );
      const datasetWithFullData = { ...dataset.toObject ? dataset.toObject() : dataset, data: fullData };

      const analysis = await geminiService.analyzeDataset(datasetWithFullData);
      analysisResults.push(analysis);
      if (progressUpdater) await progressUpdater(10 + Math.round((i / project.datasets.length) * 40), `Analizado dataset ${i + 1}/${project.datasets.length}`);
    }

    if (progressUpdater) await progressUpdater(55, 'Generando documentación con Gemini');
    // Pasar datasets con datos completos para que la documentación refleje el 100% del dataset
    const datasetsWithFullData = await Promise.all(
      project.datasets.map(async (ds: any) => {
        const fullData = await loadFullDatasetData(ds._id.toString(), ds.data);
        return { ...(ds.toObject ? ds.toObject() : ds), data: fullData };
      })
    );
    const documentation = await geminiService.generateDocumentation(
      datasetsWithFullData,
      project.name,
      project.description
    );
    const safeDocumentation = sanitizeHtmlContent(documentation);
    project.documentation = safeDocumentation.length > MAX_DOCUMENTATION_LENGTH
      ? safeDocumentation.substring(0, MAX_DOCUMENTATION_LENGTH) + '\n</div></body></html>'
      : safeDocumentation;

    if (progressUpdater) await progressUpdater(75, 'Generando widgets y dashboard');
    project.status = ProjectStatus.READY;

    if (analysisResults.length > 0) {
      const firstAnalysis = analysisResults[0];
      const validVisualizations = firstAnalysis.visualizations || [];
      const dashboardWidgets: Widget[] = [];
      const VALID_CHART_TYPES = ['bar', 'line', 'pie', 'scatter', 'area'] as const;
      type ValidChartType = typeof VALID_CHART_TYPES[number];
      const sanitizeChartType = (t: string | undefined): ValidChartType =>
        VALID_CHART_TYPES.includes(t as ValidChartType) ? (t as ValidChartType) : 'bar';

      validVisualizations.forEach((viz, index) => {
        const firstColumn = project.datasets[0]?.metadata?.columns?.[0]?.name || 'categoria';
        const secondColumn = project.datasets[0]?.metadata?.columns?.[1]?.name || 'valor';

        dashboardWidgets.push({
          id: `widget-${index}`,
          type: 'chart',
          title: viz.title || `Gráfico ${index + 1}`,
          description: viz.description || 'Visualización de datos',
          config: {
            chartType: sanitizeChartType(viz.chartType),
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

      if (dashboardWidgets.length < 2) {
        const domainWidgets = buildDomainWidgets(project);
        domainWidgets.forEach((widget) => {
          if (dashboardWidgets.length < 3) {
            dashboardWidgets.push(widget);
          }
        });
      }

      project.dashboard = {
        title: `${getDomainTemplate(project.domain).title} - ${project.name}`,
        description: firstAnalysis.summary || getDomainTemplate(project.domain).description || `Dashboard interactivo para ${project.name}`,
        widgets: dashboardWidgets,
        layout: {
          columns: 12,
          rowHeight: 150,
          margin: [10, 10]
        },
        generatedAt: new Date()
      } as any;
    } else {
      const domainTemplate = getDomainTemplate(project.domain);
      const fallbackWidgets = buildDomainWidgets(project).slice(0, 3);
      project.dashboard = {
        title: `${domainTemplate.title} - ${project.name}`,
        description: domainTemplate.description,
        widgets: fallbackWidgets,
        layout: {
          columns: 12,
          rowHeight: 150,
          margin: [10, 10]
        },
        generatedAt: new Date()
      } as any;
    }

    syncReliabilityAlerts(project);
    await project.save();
    if (progressUpdater) await progressUpdater(95, 'Guardando proyecto y finalizando');
    if (progressUpdater) await progressUpdater(100, 'Completado');
  } catch (error) {
    project.status = ProjectStatus.ERROR;
    await project.save();
    const errMsg = error instanceof Error ? error.message : String(error);
    if (progressUpdater) await progressUpdater(100, `Error: ${errMsg}`);
    throw error;
  }
}