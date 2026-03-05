'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  DocumentTextIcon,
  TableCellsIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  UserIcon,
  PlayIcon,
  DocumentDuplicateIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
  PhotoIcon,
  TableCellsIcon as TableIcon,
  CodeBracketIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { projectsApi, uploadApi } from '@/lib/api';
import { Project, Dataset } from '@/types';

/** Convierte markdown básico (**negrita**, saltos de línea) en JSX */
function renderMarkdown(text: string) {
  return text.split('\n').map((line, li) => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let last = 0;
    let match;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index));
      parts.push(<strong key={match.index} className="font-semibold text-gray-900">{match[1]}</strong>);
      last = match.index + match[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return (
      <span key={li}>
        {parts.length > 0 ? parts : '\u00a0'}
        {li < text.split('\n').length - 1 && <br />}
      </span>
    );
  });
}
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = params.id as string;
  
  const [activeTab, setActiveTab] = useState('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Chart modal + chatbot
  const [activeWidget, setActiveWidget] = useState<null | {
    widget: any;
    chartData: { name: string; value: number }[];
    xKey: string;
    yKey: string;
    chartType: string;
    colors: string[];
  }>(null);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chartExportRef = useRef<HTMLDivElement>(null);

  // Custom widget generation modal
  const [showCustomWidgetModal, setShowCustomWidgetModal] = useState(false);
  const [customWidgetPrompt, setCustomWidgetPrompt] = useState('');

  const closeModal = useCallback(() => {
    setActiveWidget(null);
    setChatHistory([]);
    setChatInput('');
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeModal]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  const handleOpenWidget = useCallback((widget: any, rawData: any[]) => {
    const xKey: string = widget.config?.xAxis || 'categoria';
    const yKey: string = widget.config?.yAxis || 'valor';
    const chartType: string = widget.config?.chartType || 'bar';
    const colors: string[] = widget.config?.colors || ['#667eea', '#48bb78', '#f59e0b', '#ef4444', '#8b5cf6'];
    const aggregated: Record<string, number> = {};
    rawData.slice(0, 50).forEach((row: any) => {
      const k = String(row[xKey] ?? 'Sin dato');
      const v = parseFloat(row[yKey]) || 0;
      aggregated[k] = (aggregated[k] || 0) + v;
    });
    const chartData = Object.entries(aggregated)
      .slice(0, 10)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

    setChatHistory([{
      role: 'ai',
      text: `Hola, soy tu analista de datos. Estás viendo el gráfico "${widget.title}". Los datos muestran ${chartType === 'line' ? 'una tendencia' : chartType === 'pie' ? 'una distribución' : 'una comparación'} de ${yKey} por ${xKey}. ¿Qué deseas saber?`,
    }]);
    setActiveWidget({ widget, chartData, xKey, yKey, chartType, colors });
  }, []);

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || !activeWidget || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);
    try {
      const res = await projectsApi.chatWidget(projectId, {
        message: userMsg,
        widgetContext: {
          widgetTitle: activeWidget.widget.title,
          widgetDescription: activeWidget.widget.description,
          chartType: activeWidget.chartType,
          xKey: activeWidget.xKey,
          yKey: activeWidget.yKey,
          dataSample: activeWidget.chartData,
        },
        conversationHistory: chatHistory,
      });
      setChatHistory(prev => [...prev, { role: 'ai', text: res.data.data?.reply || 'Sin respuesta' }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Ocurrió un error al consultar la IA. Intenta de nuevo.' }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, activeWidget, isChatLoading, chatHistory, projectId]);

  const downloadCSV = useCallback(() => {
    if (!activeWidget) return;
    const headers = [activeWidget.xKey, activeWidget.yKey];
    const rows = activeWidget.chartData.map(d => [d.name, d.value]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${activeWidget.widget.title.replace(/\s+/g, '_')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [activeWidget]);

  const downloadJSON = useCallback(() => {
    if (!activeWidget) return;
    const payload = activeWidget.chartData.map(d => ({ [activeWidget.xKey]: d.name, [activeWidget.yKey]: d.value }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${activeWidget.widget.title.replace(/\s+/g, '_')}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [activeWidget]);

  const downloadSVG = useCallback(() => {
    if (!chartExportRef.current) return;
    const svgEl = chartExportRef.current.querySelector('svg');
    if (!svgEl) return;
    const serialized = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([serialized], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${activeWidget?.widget.title.replace(/\s+/g, '_') || 'chart'}.svg`;
    a.click(); URL.revokeObjectURL(url);
  }, [activeWidget]);

  // Get project data
  const { data: projectData, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  });

  const project: Project | undefined = projectData?.data?.data;

  // Get dashboard data
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => projectsApi.getDashboard(projectId),
    enabled: !!projectId && !!project?.dashboard,
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.deleteProject(projectId),
    onSuccess: () => {
      toast.success('Proyecto eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/dashboard/projects');
    },
    onError: () => {
      toast.error('Error al eliminar el proyecto');
    },
  });

  // Delete dataset mutation
  const deleteDatasetMutation = useMutation({
    mutationFn: (datasetId: string) => uploadApi.deleteDataset(projectId, datasetId),
    onSuccess: () => {
      toast.success('Dataset eliminado');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: () => {
      toast.error('Error al eliminar el dataset');
    },
  });

  // Analyze project mutation
  const analyzeMutation = useMutation({
    mutationFn: () => projectsApi.analyzeProject(projectId),
    onSuccess: () => {
      setIsAnalyzing(false);
      toast.success('¡Análisis completado! Dashboard y documentación generados.');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error: any) => {
      setIsAnalyzing(false);
      const msg = error?.response?.data?.message || 'Error al analizar el proyecto';
      toast.error(msg);
    },
  });

  const handleDeleteProject = () => {
    if (confirm('¿Estás seguro de que quieres eliminar este proyecto? Esta acción no se puede deshacer.')) {
      deleteMutation.mutate();
    }
  };

  const handleAnalyzeProject = () => {
    setIsAnalyzing(true);
    analyzeMutation.mutate();
  };

  // Generate custom widget mutation
  const generateWidgetMutation = useMutation({
    mutationFn: (prompt: string) => projectsApi.generateCustomWidget(projectId, prompt),
    onSuccess: () => {
      toast.success('¡Widget generado y guardado en el dashboard!');
      setShowCustomWidgetModal(false);
      setCustomWidgetPrompt('');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Error al generar el widget';
      toast.error(msg);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'analyzing':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Cargando proyecto...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Proyecto no encontrado</h1>
          <p className="text-gray-600 mb-4">El proyecto que buscas no existe o no tienes permisos para verlo.</p>
          <button
            onClick={() => router.push('/dashboard/projects')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Volver a Proyectos
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', name: 'Resumen', icon: EyeIcon },
    { id: 'datasets', name: 'Datasets', icon: TableCellsIcon },
    { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
    { id: 'documentation', name: 'Documentación', icon: DocumentTextIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modal de carga durante el análisis */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4"
            >
              {/* Spinner */}
              <div className="relative w-20 h-20">
                <svg className="animate-spin w-20 h-20 text-green-500" viewBox="0 0 50 50">
                  <circle className="opacity-20" cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="5" fill="none" />
                  <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="5" fill="none"
                    strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
                </svg>
                <SparklesIcon className="absolute inset-0 m-auto w-8 h-8 text-green-600" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Analizando con IA</h3>
                <p className="text-gray-500 text-sm">Gemini está procesando tu dataset, generando el dashboard y la documentación. Esto puede tardar unos segundos…</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div key={i} className="w-2 h-2 rounded-full bg-green-500"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard/projects')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Volver
              </button>

              <div>
                <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-gray-600 mt-1">{project.description}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {project.datasets?.length || 0} datasets
              </span>
              
              <button
                onClick={handleAnalyzeProject}
                disabled={isAnalyzing || analyzeMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <PlayIcon className="h-4 w-4 mr-2" />
                {isAnalyzing ? 'Analizando…' : 'Analizar con IA'}
              </button>

              <button
                onClick={() => router.push(`/dashboard/projects/${projectId}/edit`)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Editar
              </button>

              <button
                onClick={handleDeleteProject}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Eliminar
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Project Info */}
              <div className="lg:col-span-2">
                <div className="bg-white shadow rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Información del Proyecto</h3>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 flex items-center">
                        <UserIcon className="h-4 w-4 mr-1" />
                        Creador
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">Usuario actual</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 flex items-center">
                        <CalendarDaysIcon className="h-4 w-4 mr-1" />
                        Fecha de creación
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(project.createdAt).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 flex items-center">
                        <TableCellsIcon className="h-4 w-4 mr-1" />
                        Datasets
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">{project.datasets?.length || 0} archivos</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 flex items-center">
                        <ChartBarIcon className="h-4 w-4 mr-1" />
                        Dashboard
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {project.dashboard ? 'Generado' : 'No generado'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Recent Activity */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Actividad Reciente</h3>
                  <div className="flow-root">
                    <ul className="-mb-8">
                      <li className="relative pb-8">
                        <div className="relative flex space-x-3">
                          <div className="flex-shrink-0">
                            <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                              <DocumentDuplicateIcon className="h-4 w-4 text-white" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                Proyecto <span className="font-medium text-gray-900">creado</span>
                              </p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              {new Date(project.createdAt).toLocaleDateString('es-ES')}
                            </div>
                          </div>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-6">
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Estadísticas</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Total de registros</span>
                      <span className="text-lg font-bold text-gray-900">
                        {project.datasets?.reduce((acc, dataset) => acc + (dataset.metadata?.rowCount || 0), 0) || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Tamaño total</span>
                      <span className="text-lg font-bold text-gray-900">
                        {formatFileSize(project.datasets?.reduce((acc, dataset) => acc + dataset.size, 0) || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Última actualización</span>
                      <span className="text-sm text-gray-900">
                        {new Date(project.updatedAt).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'datasets' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Datasets del Proyecto</h3>
                <button
                  onClick={() => router.push(`/dashboard/projects/${projectId}/edit`)}
                  className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
                >
                  <TableCellsIcon className="h-3.5 w-3.5 mr-1" />
                  Agregar Dataset
                </button>
              </div>
              <div className="p-6">
                {project.datasets && project.datasets.length > 0 ? (
                  <div className="space-y-4">
                    {project.datasets.map((dataset: Dataset) => (
                      <div key={dataset._id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                              <TableCellsIcon className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900">{dataset.originalName}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {formatFileSize(dataset.size)} &bull; {(dataset.metadata?.rowCount || 0).toLocaleString()} registros &bull; {dataset.metadata?.columns?.length || 0} columnas
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">Subido el {new Date(dataset.uploadedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              {dataset.mimetype.split('/').pop()?.toUpperCase() || 'CSV'}
                            </span>
                            <button
                              onClick={() => {
                                if (confirm(`¿Eliminar "${dataset.originalName}"? Esta acción no se puede deshacer.`)) {
                                  deleteDatasetMutation.mutate(dataset._id);
                                }
                              }}
                              disabled={deleteDatasetMutation.isPending}
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                              title="Eliminar dataset"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {dataset.metadata?.columns && dataset.metadata.columns.length > 0 && (
                          <div className="border-t border-gray-100 pt-3 mt-1">
                            <p className="text-xs font-medium text-gray-500 mb-1.5">Columnas detectadas:</p>
                            <div className="flex flex-wrap gap-1">
                              {dataset.metadata.columns.slice(0, 12).map((col) => (
                                <span key={col.name} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-50 border border-gray-200 text-gray-600">
                                  {col.name}
                                  <span className="ml-1 text-gray-400">{col.type === 'number' ? '#' : col.type === 'date' ? '📅' : 'A'}</span>
                                </span>
                              ))}
                              {dataset.metadata.columns.length > 12 && (
                                <span className="text-xs text-gray-400 self-center">+{dataset.metadata.columns.length - 12} más</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TableCellsIcon className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Sin datasets</h3>
                    <p className="mt-1 text-sm text-gray-500 mb-4">Este proyecto no tiene datasets cargados aún.</p>
                    <button
                      onClick={() => router.push(`/dashboard/projects/${projectId}/edit`)}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <TableCellsIcon className="h-4 w-4 mr-2" />
                      Subir Dataset
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {project.dashboard?.title || 'Dashboard del Proyecto'}
                </h3>
                {project.dashboard && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {project.dashboard.widgets?.length || 0} gráficos generados
                    </span>
                    <button
                      onClick={() => setShowCustomWidgetModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium shadow-sm hover:from-violet-700 hover:to-indigo-700 active:scale-95 transition-all"
                      title="Generar gráfico personalizado con IA"
                    >
                      <SparklesIcon className="h-4 w-4" />
                      Generar con IA
                    </button>
                  </div>
                )}
              </div>
              <div className="p-6">
                {project.dashboard && project.dashboard.widgets && project.dashboard.widgets.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {project.dashboard.widgets.map((widget: any) => {
                      // Obtener datos del primer dataset del proyecto
                      const rawData: any[] = project.datasets?.[0]?.data || [];
                      const xKey: string = widget.config?.xAxis || 'categoria';
                      const yKey: string = widget.config?.yAxis || 'valor';
                      const chartType: string = widget.config?.chartType || 'bar';
                      const colors: string[] = widget.config?.colors || ['#667eea', '#48bb78', '#f59e0b', '#ef4444', '#8b5cf6'];

                      // Agregar datos por xKey
                      const aggregated: Record<string, number> = {};
                      rawData.slice(0, 50).forEach((row: any) => {
                        const k = String(row[xKey] ?? 'Sin dato');
                        const v = parseFloat(row[yKey]) || 0;
                        aggregated[k] = (aggregated[k] || 0) + v;
                      });
                      const chartData = Object.entries(aggregated)
                        .slice(0, 10)
                        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

                      const axisLabelStyle = { fontSize: 11, fill: '#6b7280', fontWeight: 600 };
                      const chartMargin = { top: 10, right: 20, left: 10, bottom: 44 };
                      const tooltipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' };

                      return (
                        <div
                          key={widget.id}
                          className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm cursor-pointer group relative hover:border-blue-300 hover:shadow-md transition-all duration-150"
                          onDoubleClick={() => handleOpenWidget(widget, rawData)}
                          title="Doble clic para analizar con IA"
                        >
                          {/* Double click hint badge */}
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-500 text-[10px] font-medium">
                              <SparklesIcon className="h-3 w-3" />
                              Doble clic
                            </span>
                          </div>
                          {/* Card header */}
                          <h4 className="font-semibold text-gray-900 text-sm mb-0.5">{widget.title}</h4>
                          <p className="text-xs text-gray-500 mb-4 leading-snug">{widget.description}</p>

                          {chartData.length === 0 ? (
                            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                              Sin datos para mostrar
                            </div>
                          ) : (
                            <>
                              <ResponsiveContainer width="100%" height={240}>
                                {chartType === 'pie' ? (
                                  <PieChart>
                                    <Pie
                                      data={chartData}
                                      dataKey="value"
                                      nameKey="name"
                                      cx="50%"
                                      cy="50%"
                                      outerRadius={85}
                                      label={({ name, percent }) =>
                                        `${name.length > 9 ? name.slice(0, 9) + '…' : name} (${(percent * 100).toFixed(0)}%)`
                                      }
                                      labelLine={true}
                                    >
                                      {chartData.map((_, i) => (
                                        <Cell key={i} fill={colors[i % colors.length]} />
                                      ))}
                                    </Pie>
                                    <Tooltip
                                      formatter={(v: any, _: any, props: any) => [v.toLocaleString(), props.payload?.name]}
                                      contentStyle={tooltipStyle}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                  </PieChart>
                                ) : chartType === 'line' ? (
                                  <LineChart data={chartData} margin={chartMargin}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                    <XAxis
                                      dataKey="name"
                                      tick={{ fontSize: 10 }}
                                      tickFormatter={(v) => v.length > 9 ? v.slice(0, 9) + '…' : v}
                                      label={{ value: xKey, position: 'insideBottom', offset: -28, style: axisLabelStyle }}
                                    />
                                    <YAxis
                                      tick={{ fontSize: 10 }}
                                      width={55}
                                      tickFormatter={(v) => typeof v === 'number' && v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}
                                      label={{ value: yKey, angle: -90, position: 'insideLeft', offset: 12, style: axisLabelStyle }}
                                    />
                                    <Tooltip
                                      labelFormatter={(label) => `${xKey}: ${label}`}
                                      formatter={(v: any) => [v.toLocaleString(), yKey]}
                                      contentStyle={tooltipStyle}
                                    />
                                    <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2.5} dot={{ fill: colors[0], r: 4 }} activeDot={{ r: 6 }} />
                                  </LineChart>
                                ) : chartType === 'area' ? (
                                  <AreaChart data={chartData} margin={chartMargin}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                    <XAxis
                                      dataKey="name"
                                      tick={{ fontSize: 10 }}
                                      tickFormatter={(v) => v.length > 9 ? v.slice(0, 9) + '…' : v}
                                      label={{ value: xKey, position: 'insideBottom', offset: -28, style: axisLabelStyle }}
                                    />
                                    <YAxis
                                      tick={{ fontSize: 10 }}
                                      width={55}
                                      tickFormatter={(v) => typeof v === 'number' && v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}
                                      label={{ value: yKey, angle: -90, position: 'insideLeft', offset: 12, style: axisLabelStyle }}
                                    />
                                    <Tooltip
                                      labelFormatter={(label) => `${xKey}: ${label}`}
                                      formatter={(v: any) => [v.toLocaleString(), yKey]}
                                      contentStyle={tooltipStyle}
                                    />
                                    <Area type="monotone" dataKey="value" stroke={colors[0]} fill={colors[0] + '30'} strokeWidth={2.5} />
                                  </AreaChart>
                                ) : (
                                  <BarChart data={chartData} margin={chartMargin}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                    <XAxis
                                      dataKey="name"
                                      tick={{ fontSize: 10 }}
                                      tickFormatter={(v) => v.length > 9 ? v.slice(0, 9) + '…' : v}
                                      label={{ value: xKey, position: 'insideBottom', offset: -28, style: axisLabelStyle }}
                                    />
                                    <YAxis
                                      tick={{ fontSize: 10 }}
                                      width={55}
                                      tickFormatter={(v) => typeof v === 'number' && v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}
                                      label={{ value: yKey, angle: -90, position: 'insideLeft', offset: 12, style: axisLabelStyle }}
                                    />
                                    <Tooltip
                                      labelFormatter={(label) => `${xKey}: ${label}`}
                                      formatter={(v: any) => [v.toLocaleString(), yKey]}
                                      contentStyle={tooltipStyle}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                                      {chartData.map((_, i) => (
                                        <Cell key={i} fill={colors[i % colors.length]} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                )}
                              </ResponsiveContainer>

                              {/* Axis legend badges */}
                              {chartType !== 'pie' && (
                                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-gray-200 text-gray-600 text-[9px] font-bold">X</span>
                                    <span className="text-xs text-gray-500 font-medium">{xKey}</span>
                                  </div>
                                  <div className="w-px h-3 bg-gray-200" />
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-600 text-[9px] font-bold">Y</span>
                                    <span className="text-xs text-gray-500 font-medium">{yKey}</span>
                                  </div>
                                  <div className="ml-auto">
                                    <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 capitalize">{chartType}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Sin dashboard</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Ejecuta un análisis para generar el dashboard.
                    </p>
                    <button
                      onClick={handleAnalyzeProject}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                    >
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Generar Dashboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'documentation' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Documentación del Proyecto</h3>
              </div>
              <div className="p-0">
                {project.documentation ? (
                  project.documentation.startsWith('<!DOCTYPE html>') || project.documentation.startsWith('<html') ? (
                    <iframe
                      srcDoc={project.documentation.replace('</body>', `<script>
(function(){
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      e.preventDefault();
      var id = this.getAttribute('href').slice(1);
      var el = document.getElementById(id);
      if(el) el.scrollIntoView({behavior:'smooth'});
    });
  });
})();
<\/script></body>`)}
                      className="w-full border-0 rounded-b-lg"
                      style={{ minHeight: '82vh' }}
                      title="Documentación del Proyecto"
                      sandbox="allow-same-origin allow-scripts"
                    />
                  ) : (
                    <div className="p-6 prose max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700">
                        {project.documentation}
                      </pre>
                    </div>
                  )
                ) : (
                  <div className="text-center py-12">
                    <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Sin documentación</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Este proyecto aún no tiene documentación generada.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Custom Widget Generation Modal ── */}
      <AnimatePresence>
        {showCustomWidgetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget && !generateWidgetMutation.isPending) setShowCustomWidgetModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <SparklesIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Generar Gráfico con IA</h2>
                    <p className="text-xs text-violet-200">Describe qué quieres visualizar</p>
                  </div>
                </div>
                <button
                  onClick={() => { if (!generateWidgetMutation.isPending) { setShowCustomWidgetModal(false); setCustomWidgetPrompt(''); } }}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    ¿Qué gráfico quieres generar?
                  </label>
                  <textarea
                    value={customWidgetPrompt}
                    onChange={(e) => setCustomWidgetPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && customWidgetPrompt.trim() && !generateWidgetMutation.isPending) {
                        generateWidgetMutation.mutate(customWidgetPrompt.trim());
                      }
                    }}
                    disabled={generateWidgetMutation.isPending}
                    placeholder="Ej: genera un gráfico de barras de ventas por región, muestra la distribución de productos en un pie chart, crea una línea de tendencia de ingresos por mes..."
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Ctrl+Enter para generar • La IA elegirá las columnas más adecuadas del dataset
                  </p>
                </div>

                {/* Example prompts */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ejemplos rápidos</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Gráfico de barras por categoría',
                      'Tendencia de valores en el tiempo',
                      'Distribución en pastel',
                      'Comparación de dos métricas',
                    ].map((example) => (
                      <button
                        key={example}
                        onClick={() => setCustomWidgetPrompt(example)}
                        disabled={generateWidgetMutation.isPending}
                        className="px-2.5 py-1 rounded-full text-xs bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-50"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  onClick={() => { setShowCustomWidgetModal(false); setCustomWidgetPrompt(''); }}
                  disabled={generateWidgetMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => generateWidgetMutation.mutate(customWidgetPrompt.trim())}
                  disabled={!customWidgetPrompt.trim() || generateWidgetMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium shadow-sm hover:from-violet-700 hover:to-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {generateWidgetMutation.isPending ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generando...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-4 w-4" />
                      Generar Gráfico
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Widget AI Chat Modal ── */}
      <AnimatePresence>
        {activeWidget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
              style={{ maxHeight: '90vh' }}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-blue-50 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <SparklesIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{activeWidget.widget.title}</h2>
                    <p className="text-xs text-gray-500">Análisis inteligente con Gemini AI</p>
                  </div>
                </div>
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

                {/* Left: chart + data + downloads */}
                <div className="w-[45%] border-r border-gray-100 flex flex-col gap-4 p-5 overflow-y-auto">

                  {/* Chart */}
                  <div ref={chartExportRef} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <ResponsiveContainer width="100%" height={240}>
                      {activeWidget.chartType === 'pie' ? (
                        <PieChart>
                          <Pie data={activeWidget.chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                            label={({ name, percent }) => `${name.length > 8 ? name.slice(0,8)+'\u2026' : name} (${(percent*100).toFixed(0)}%)`}>
                            {activeWidget.chartData.map((_, i) => <Cell key={i} fill={activeWidget.colors[i % activeWidget.colors.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      ) : activeWidget.chartType === 'line' ? (
                        <LineChart data={activeWidget.chartData} margin={{ top: 10, right: 20, left: 10, bottom: 44 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickFormatter={v => v.length > 9 ? v.slice(0,9)+'\u2026' : v} label={{ value: activeWidget.xKey, position: 'insideBottom', offset: -28, style: { fontSize: 11, fill: '#6b7280', fontWeight: 600 } }} />
                          <YAxis tick={{ fontSize: 10 }} width={55} tickFormatter={(v: number) => v >= 1000 ? (v/1000).toFixed(1)+'k' : String(v)} label={{ value: activeWidget.yKey, angle: -90, position: 'insideLeft', offset: 12, style: { fontSize: 11, fill: '#6b7280', fontWeight: 600 } }} />
                          <Tooltip labelFormatter={l => `${activeWidget.xKey}: ${l}`} formatter={(v: any) => [v.toLocaleString(), activeWidget.yKey]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Line type="monotone" dataKey="value" stroke={activeWidget.colors[0]} strokeWidth={2.5} dot={{ fill: activeWidget.colors[0], r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      ) : activeWidget.chartType === 'area' ? (
                        <AreaChart data={activeWidget.chartData} margin={{ top: 10, right: 20, left: 10, bottom: 44 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickFormatter={v => v.length > 9 ? v.slice(0,9)+'\u2026' : v} label={{ value: activeWidget.xKey, position: 'insideBottom', offset: -28, style: { fontSize: 11, fill: '#6b7280', fontWeight: 600 } }} />
                          <YAxis tick={{ fontSize: 10 }} width={55} tickFormatter={(v: number) => v >= 1000 ? (v/1000).toFixed(1)+'k' : String(v)} label={{ value: activeWidget.yKey, angle: -90, position: 'insideLeft', offset: 12, style: { fontSize: 11, fill: '#6b7280', fontWeight: 600 } }} />
                          <Tooltip labelFormatter={l => `${activeWidget.xKey}: ${l}`} formatter={(v: any) => [v.toLocaleString(), activeWidget.yKey]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Area type="monotone" dataKey="value" stroke={activeWidget.colors[0]} fill={activeWidget.colors[0]+'30'} strokeWidth={2.5} />
                        </AreaChart>
                      ) : (
                        <BarChart data={activeWidget.chartData} margin={{ top: 10, right: 20, left: 10, bottom: 44 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickFormatter={v => v.length > 9 ? v.slice(0,9)+'\u2026' : v} label={{ value: activeWidget.xKey, position: 'insideBottom', offset: -28, style: { fontSize: 11, fill: '#6b7280', fontWeight: 600 } }} />
                          <YAxis tick={{ fontSize: 10 }} width={55} tickFormatter={(v: number) => v >= 1000 ? (v/1000).toFixed(1)+'k' : String(v)} label={{ value: activeWidget.yKey, angle: -90, position: 'insideLeft', offset: 12, style: { fontSize: 11, fill: '#6b7280', fontWeight: 600 } }} />
                          <Tooltip labelFormatter={l => `${activeWidget.xKey}: ${l}`} formatter={(v: any) => [v.toLocaleString(), activeWidget.yKey]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Bar dataKey="value" radius={[4,4,0,0]} maxBarSize={48}>
                            {activeWidget.chartData.map((_, i) => <Cell key={i} fill={activeWidget.colors[i % activeWidget.colors.length]} />)}
                          </Bar>
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Axis badges */}
                  {activeWidget.chartType !== 'pie' && (
                    <div className="flex items-center gap-3 px-1">
                      <span className="w-5 h-5 rounded bg-gray-200 text-gray-600 text-[9px] font-bold flex items-center justify-center">X</span>
                      <span className="text-xs text-gray-600 font-medium">{activeWidget.xKey}</span>
                      <div className="w-px h-3 bg-gray-200" />
                      <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 text-[9px] font-bold flex items-center justify-center">Y</span>
                      <span className="text-xs text-gray-600 font-medium">{activeWidget.yKey}</span>
                      <span className="ml-auto text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 capitalize">{activeWidget.chartType}</span>
                    </div>
                  )}

                  {/* Download */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Descargar</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={downloadCSV} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
                        <TableIcon className="h-5 w-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                        <span className="text-[10px] font-semibold text-gray-500 group-hover:text-emerald-700">CSV</span>
                      </button>
                      <button onClick={downloadJSON} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group">
                        <CodeBracketIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                        <span className="text-[10px] font-semibold text-gray-500 group-hover:text-blue-700">JSON</span>
                      </button>
                      <button onClick={downloadSVG} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all group">
                        <PhotoIcon className="h-5 w-5 text-gray-400 group-hover:text-violet-600 transition-colors" />
                        <span className="text-[10px] font-semibold text-gray-500 group-hover:text-violet-700">SVG</span>
                      </button>
                    </div>
                  </div>

                  {/* Data table */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Datos</p>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-gray-100">{activeWidget.xKey}</th>
                            <th className="text-right px-3 py-2 font-semibold text-gray-600 border-b border-gray-100">{activeWidget.yKey}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {activeWidget.chartData.map((d, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-1.5 text-gray-700 font-medium truncate max-w-[120px]">{d.name}</td>
                              <td className="px-3 py-1.5 text-gray-600 text-right tabular-nums">{d.value.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right: chatbot */}
                <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>

                  {/* Chat header */}
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2.5 bg-slate-50 flex-shrink-0">
                    <div className="p-1.5 bg-blue-600 rounded-lg">
                      <ChatBubbleLeftRightIcon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Analista IA</p>
                      <p className="text-[10px] text-gray-500">Consulta sobre este gráfico</p>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      En línea
                    </span>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-violet-500 to-blue-600 text-white'}`}>
                          {msg.role === 'user' ? 'T' : 'IA'}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                          {msg.role === 'ai' ? renderMarkdown(msg.text) : msg.text}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">IA</div>
                        <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Suggested prompts */}
                  {chatHistory.length <= 1 && (
                    <div className="px-5 pb-2 flex flex-wrap gap-1.5">
                      {[
                        `\u00bfCuál es el valor más alto de ${activeWidget.yKey}?`,
                        '\u00bfQué tendencia observas?',
                        'Dame un resumen ejecutivo',
                        '\u00bfQué recomiendas mejorar?',
                        `Compara los valores de ${activeWidget.xKey}`,
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => setChatInput(prompt)}
                          className="px-3 py-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-full hover:bg-blue-100 transition-colors text-left"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input */}
                  <div className="px-5 py-4 border-t border-gray-100 bg-white flex-shrink-0">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                        placeholder="Pregunta sobre este gráfico... (Enter para enviar)"
                        rows={2}
                        className="flex-1 resize-none px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                      />
                      <button
                        onClick={handleSendChat}
                        disabled={!chatInput.trim() || isChatLoading}
                        className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                      >
                        <PaperAirplaneIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5 text-center">Respuestas generadas con Gemini AI · basadas en los datos reales</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}