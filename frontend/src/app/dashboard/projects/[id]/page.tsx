'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  LinkIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { projectsApi, uploadApi, jobsApi } from '@/lib/api';
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

// Descripciones amigables para ejecutivos no técnicos
const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string; hint: string }> = {
  number: {
    label: 'Número',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: '#',
    hint: 'Valor numérico — se puede sumar, promediar y graficar',
  },
  date: {
    label: 'Fecha',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    icon: '◷',
    hint: 'Fecha o tiempo — permite ver tendencias y evolución',
  },
  string: {
    label: 'Texto',
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    icon: 'A',
    hint: 'Categoría o texto — permite agrupar y segmentar',
  },
};

function DatasetColumns({ columns }: { columns: Array<{ name: string; type: string }> }) {
  const [expanded, setExpanded] = React.useState(false);
  const VISIBLE = 14;
  const shown = expanded ? columns : columns.slice(0, VISIBLE);
  const hidden = columns.length - VISIBLE;

  return (
    <div className="border-t border-gray-100 pt-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {columns.length} campos del dataset
        </span>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          {Object.entries(TYPE_META).map(([type, meta]) => (
            <span key={type} className="flex items-center gap-1">
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold ${meta.bg} ${meta.color} border ${meta.border}`}>
                {meta.icon}
              </span>
              {meta.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((col) => {
          const meta = TYPE_META[col.type] ?? TYPE_META.string;
          return (
            <span
              key={col.name}
              title={`${col.name} — ${meta.hint}`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border cursor-default transition-all hover:shadow-sm ${meta.bg} ${meta.color} ${meta.border}`}
            >
              <span className="font-bold text-[10px] opacity-60">{meta.icon}</span>
              {col.name}
            </span>
          );
        })}
        {!expanded && hidden > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 transition-colors"
          >
            +{hidden} más
          </button>
        )}
        {expanded && hidden > 0 && (
          <button
            onClick={() => setExpanded(false)}
            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 transition-colors"
          >
            Ver menos
          </button>
        )}
      </div>
    </div>
  );
}

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const projectId = params.id as string;
  const shareToken = searchParams.get('share') || undefined;
  
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
  const [shareEnabled, setShareEnabled] = useState(false);
  const [sharePermission, setSharePermission] = useState<'viewer' | 'editor'>('viewer');
  const [shareLink, setShareLink] = useState('');
  const generationToastRef = useRef<string | null>(null);
  const previousStatusRef = useRef<string | undefined>(undefined);
  const analysisPollRef = useRef<number | null>(null);

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
    queryKey: ['project', projectId, shareToken || 'owner'],
    queryFn: () => projectsApi.getProject(projectId, shareToken),
    enabled: !!projectId,
  });

  const project: Project | undefined = projectData?.data?.data;
  const accessMode = project?.access || 'owner';
  const canEdit = accessMode === 'owner' || accessMode === 'editor';
  const canShare = accessMode === 'owner';

  useEffect(() => {
    if (project?.status !== 'analyzing') {
      return;
    }

    const intervalId = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId, shareToken || 'owner'] });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [project?.status, projectId, queryClient]);

  useEffect(() => {
    setIsAnalyzing(project?.status === 'analyzing');
  }, [project?.status]);

  useEffect(() => {
    if (project?.sharing) {
      setShareEnabled(!!project.sharing.enabled);
      setSharePermission(project.sharing.permission || 'viewer');
      if (project.shareLink) {
        setShareLink(project.shareLink);
      }
    }
  }, [project?.sharing, project?.shareLink]);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const currentStatus = project?.status;

    if (previousStatus === 'analyzing' && currentStatus && currentStatus !== 'analyzing') {
      if (generationToastRef.current) {
        toast.dismiss(generationToastRef.current);
        generationToastRef.current = null;
      }

      if (currentStatus === 'ready') {
        toast.success(
          project?.stats?.hasDocumentation
            ? 'Dashboard y documentación generados correctamente'
            : 'Dashboard generado correctamente'
        );
      } else if (currentStatus === 'error') {
        toast.error('No se pudo generar el dashboard y la documentación');
      }
    }

    previousStatusRef.current = currentStatus;
  }, [project?.status, project?.stats?.hasDocumentation]);

  // Get dashboard data
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard', projectId, shareToken || 'owner'],
    queryFn: () => projectsApi.getDashboard(projectId, shareToken),
    enabled: !!projectId && !!project?.dashboard,
  });

  // Reliability data
  const reliabilityQuery = useQuery({
    queryKey: ['project', projectId, shareToken || 'owner', 'reliability'],
    queryFn: () => projectsApi.getReliability(projectId, shareToken),
    enabled: !!projectId && activeTab === 'reliability',
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
      queryClient.invalidateQueries({ queryKey: ['project', projectId, shareToken || 'owner'] });
    },
    onError: () => {
      toast.error('Error al eliminar el dataset');
    },
  });

  // Analyze project mutation
  const analyzeMutation = useMutation({
    mutationFn: () => projectsApi.analyzeProject(projectId, shareToken),
    onSuccess: (res: any) => {
      const jobId = res?.data?.data?.jobId;
      queryClient.invalidateQueries({ queryKey: ['project', projectId, shareToken || 'owner'] });

      if (jobId) {
        // Poll job status and update toast
        const poll = async () => {
          try {
            const r = await jobsApi.getJob(jobId);
            const job = r.data.data;
            const prog = job?.progress ?? 0;
            const msg = job?.message || '';
            if (generationToastRef.current) {
              toast.loading(`${prog}% — ${msg || 'Procesando...'}`, { id: generationToastRef.current });
            }

            if (job.status === 'completed') {
              if (generationToastRef.current) toast.success('Análisis finalizado', { id: generationToastRef.current });
              if (analysisPollRef.current) { clearInterval(analysisPollRef.current); analysisPollRef.current = null; }
              generationToastRef.current = null;
              queryClient.invalidateQueries({ queryKey: ['project', projectId, shareToken || 'owner'] });
            } else if (job.status === 'failed') {
              if (generationToastRef.current) toast.error(`Fallo: ${job.message || 'Error'}`, { id: generationToastRef.current });
              if (analysisPollRef.current) { clearInterval(analysisPollRef.current); analysisPollRef.current = null; }
              generationToastRef.current = null;
              queryClient.invalidateQueries({ queryKey: ['project', projectId, shareToken || 'owner'] });
            }
          } catch (e) {
            // network error — keep polling
          }
        };

        // run immediately then poll
        void poll();
        analysisPollRef.current = window.setInterval(poll, 2000) as unknown as number;
      }
    },
    onError: (error: any) => {
      setIsAnalyzing(false);
      if (generationToastRef.current) {
        toast.dismiss(generationToastRef.current);
        generationToastRef.current = null;
      }
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
    if (analyzeMutation.isPending || isAnalyzing || !canEdit) {
      return;
    }

    generationToastRef.current = toast.loading('Generando dashboard y documentación...');
    setIsAnalyzing(true);
    analyzeMutation.mutate();
  };

  // Generate custom widget mutation
  const generateWidgetMutation = useMutation({
    mutationFn: (prompt: string) => projectsApi.generateCustomWidget(projectId, prompt, shareToken),
    onSuccess: () => {
      toast.success('¡Widget generado y guardado en el dashboard!');
      setShowCustomWidgetModal(false);
      setCustomWidgetPrompt('');
      queryClient.invalidateQueries({ queryKey: ['project', projectId, shareToken || 'owner'] });
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
    { id: 'reliability', name: 'Confiabilidad técnica', icon: CodeBracketIcon },
  ];

  return (
    <div className="min-h-screen bg-background">
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
              className="w-full max-w-sm mx-4 rounded-2xl border border-border bg-card p-10 shadow-2xl flex flex-col items-center gap-6"
            >
              {/* Spinner */}
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 animate-spin text-primary" viewBox="0 0 50 50">
                  <circle className="opacity-20" cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="5" fill="none" />
                  <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="5" fill="none"
                    strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
                </svg>
                <SparklesIcon className="absolute inset-0 m-auto w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="mb-2 text-xl font-bold text-foreground">Analizando con IA</h3>
                <p className="text-sm text-muted-foreground">Gemini está procesando tu dataset, generando el dashboard y la documentación. Esto puede tardar unos segundos…</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div key={i} className="w-2 h-2 rounded-full bg-primary"
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
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-4 min-w-0">
              <button
                onClick={() => router.push('/dashboard/projects')}
                className="mt-0.5 flex-shrink-0 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Volver
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-foreground">{project.name}</h1>
                {(() => {
                  const desc = project.description || '';
                  // Si la descripción parece una lista de columnas (muchas comas, sin espacios largos), no mostrarla
                  const isColumnList = (desc.match(/,/g) || []).length > 5 && desc.split(' ').length < desc.split(',').length * 1.5;
                  if (!desc || isColumnList) return null;
                  return <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">{desc}</p>;
                })()}
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {project.datasets?.length || 0} datasets
              </span>
              
              {canEdit && (
                <button
                  onClick={handleAnalyzeProject}
                  disabled={isAnalyzing || analyzeMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  <PlayIcon className="h-4 w-4" />
                  {isAnalyzing ? 'Analizando…' : 'Analizar con IA'}
                </button>
              )}

              {canShare && (
                <button
                  onClick={() => router.push(`/dashboard/projects/${projectId}/edit`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent"
                >
                  <PencilIcon className="h-4 w-4" />
                  Editar
                </button>
              )}

              {canShare && (
                <button
                  onClick={handleDeleteProject}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-border">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center border-b-2 px-1 py-2 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Project Info */}
              <div className="lg:col-span-2">
                <div className="mb-6 rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-foreground">Información del Proyecto</h3>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div>
                      <dt className="flex items-center text-sm font-medium text-muted-foreground">
                        <UserIcon className="mr-1 h-4 w-4" />
                        Creador
                      </dt>
                      <dd className="mt-1 text-sm text-foreground">Usuario actual</dd>
                    </div>
                    <div>
                      <dt className="flex items-center text-sm font-medium text-muted-foreground">
                        <CalendarDaysIcon className="mr-1 h-4 w-4" />
                        Fecha de creación
                      </dt>
                      <dd className="mt-1 text-sm text-foreground">
                        {new Date(project.createdAt).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center text-sm font-medium text-muted-foreground">
                        <TableCellsIcon className="mr-1 h-4 w-4" />
                        Datasets
                      </dt>
                      <dd className="mt-1 text-sm text-foreground">{project.datasets?.length || 0} archivos</dd>
                    </div>
                    <div>
                      <dt className="flex items-center text-sm font-medium text-muted-foreground">
                        <ChartBarIcon className="mr-1 h-4 w-4" />
                        Dashboard
                      </dt>
                      <dd className="mt-1 text-sm text-foreground">
                        {project.dashboard ? 'Generado' : 'No generado'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {canShare && (
                  <div className="mb-6 rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-foreground">Compartir dashboard</h3>
                      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Solo usuarios registrados
                      </span>
                    </div>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Crea un enlace para otros usuarios autenticados. Viewer solo consulta; editor puede regenerar y modificar el dashboard.
                    </p>
                    <div className="mb-4 flex flex-wrap items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-sm text-foreground">
                        <input type="checkbox" checked={shareEnabled} onChange={(e) => setShareEnabled(e.target.checked)} />
                        Habilitar enlace
                      </label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setSharePermission('viewer')} className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${sharePermission === 'viewer' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-accent'}`}>
                          Viewer
                        </button>
                        <button type="button" onClick={() => setSharePermission('editor')} className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${sharePermission === 'editor' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-accent'}`}>
                          Editor
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await projectsApi.updateProjectShare(projectId, { enabled: shareEnabled, permission: sharePermission, regenerateToken: !shareLink });
                          const data = res.data.data;
                          if (data?.shareLink) {
                            setShareLink(data.shareLink);
                            await navigator.clipboard.writeText(data.shareLink);
                            toast.success('Enlace compartido copiado');
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Guardar y copiar enlace
                      </button>
                      {shareLink && (
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(shareLink)}
                          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4" />
                          Copiar enlace
                        </button>
                      )}
                    </div>
                    {shareLink && <div className="mt-3 break-all rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">{shareLink}</div>}
                  </div>
                )}

                {/* Recent Activity */}
                <div className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-foreground">Actividad Reciente</h3>
                  <div className="flow-root">
                    <ul className="-mb-8">
                      <li className="relative pb-8">
                        <div className="relative flex space-x-3">
                          <div className="flex-shrink-0">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                              <DocumentDuplicateIcon className="h-4 w-4 text-primary-foreground" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 flex justify-between space-x-4 pt-1.5">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                Proyecto <span className="font-medium text-foreground">creado</span>
                              </p>
                            </div>
                            <div className="whitespace-nowrap text-right text-sm text-muted-foreground">
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
                <div className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-foreground">Estadísticas</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Total de registros</span>
                      <span className="text-lg font-bold text-foreground">
                        {project.datasets?.reduce((acc, dataset) => acc + (dataset.metadata?.rowCount || 0), 0) || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Tamaño total</span>
                      <span className="text-lg font-bold text-foreground">
                        {formatFileSize(project.datasets?.reduce((acc, dataset) => acc + dataset.size, 0) || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Última actualización</span>
                      <span className="text-sm text-foreground">
                        {new Date(project.updatedAt).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'datasets' && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-4">
                <h3 className="text-lg font-semibold text-foreground">Datasets del Proyecto</h3>
                {canEdit && (
                  <button
                    onClick={() => router.push(`/dashboard/projects/${projectId}/edit`)}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <TableCellsIcon className="h-3.5 w-3.5" />
                    Agregar Dataset
                  </button>
                )}
              </div>
              <div className="p-6">
                {project.datasets && project.datasets.length > 0 ? (
                  <div className="space-y-4">
                    {project.datasets.map((dataset: Dataset) => (
                      <div key={dataset._id} className="rounded-lg border border-border bg-background/70 p-4 transition-colors hover:border-border/80">
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <TableCellsIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">{dataset.originalName}</h4>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {formatFileSize(dataset.size)} &bull; {(dataset.metadata?.rowCount || 0).toLocaleString()} registros &bull; {dataset.metadata?.columns?.length || 0} columnas
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground/70">Subido el {new Date(dataset.uploadedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {dataset.mimetype.split('/').pop()?.toUpperCase() || 'CSV'}
                            </span>
                            {canEdit && (
                              <button
                                onClick={() => {
                                  if (confirm(`¿Eliminar "${dataset.originalName}"? Esta acción no se puede deshacer.`)) {
                                    deleteDatasetMutation.mutate(dataset._id);
                                  }
                                }}
                                disabled={deleteDatasetMutation.isPending}
                                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                                title="Eliminar dataset"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {dataset.metadata?.columns && dataset.metadata.columns.length > 0 && (
                          <DatasetColumns columns={dataset.metadata.columns} />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <TableCellsIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">Sin datasets</h3>
                    <p className="mb-4 mt-1 text-sm text-muted-foreground">Este proyecto no tiene datasets cargados aún.</p>
                    {canEdit && (
                      <button
                        onClick={() => router.push(`/dashboard/projects/${projectId}/edit`)}
                        className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        <TableCellsIcon className="h-4 w-4" />
                        Subir Dataset
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {project.dashboard?.title || 'Dashboard del Proyecto'}
                </h3>
                {project.dashboard && canEdit && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {project.dashboard.widgets?.length || 0} gráficos generados
                    </span>
                    <button
                      onClick={() => setShowCustomWidgetModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all active:scale-95 hover:from-violet-700 hover:to-indigo-700"
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
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                          onDoubleClick={() => {
                            if (canEdit) {
                              handleOpenWidget(widget, rawData);
                            }
                          }}
                          title="Doble clic para analizar con IA"
                        >
                          {/* Double click hint badge */}
                          <div className="pointer-events-none absolute top-3 right-3 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              <SparklesIcon className="h-3 w-3" />
                              Doble clic
                            </span>
                          </div>
                          {/* Card header */}
                          <h4 className="mb-0.5 text-sm font-semibold text-foreground">{widget.title}</h4>
                          <p className="mb-4 leading-snug text-xs text-muted-foreground">{widget.description}</p>

                          {chartData.length === 0 ? (
                            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
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
                    {canEdit && (
                      <button
                        onClick={handleAnalyzeProject}
                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                      >
                        <PlayIcon className="h-4 w-4 mr-2" />
                        Generar Dashboard
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'documentation' && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-4">
                <h3 className="text-lg font-semibold text-foreground">Documentación del Proyecto</h3>
              </div>
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto bg-background/60">
                {project.documentation ? (
                  project.documentation.startsWith('<!DOCTYPE html>') || project.documentation.startsWith('<html') ? (
                    <iframe
                      srcDoc={sanitizeHtmlForIframe(project.documentation)}
                      className="block w-full border-0 rounded-b-2xl"
                      style={{ minHeight: '78vh', backgroundColor: 'transparent' }}
                      title="Documentación del Proyecto"
                      sandbox=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="p-6 prose max-w-none prose-invert dark:prose-invert">
                      <pre className="whitespace-pre-wrap text-sm text-foreground">
                        {project.documentation}
                      </pre>
                    </div>
                  )
                ) : (
                  <div className="py-12 text-center">
                    <DocumentTextIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">Sin documentación</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Este proyecto aún no tiene documentación generada.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'reliability' && (
            <div className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm">
              {reliabilityQuery.isLoading ? (
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
                  <span className="text-muted-foreground">Cargando métricas de confiabilidad...</span>
                </div>
              ) : reliabilityQuery.error ? (
                <div className="text-destructive">Error cargando métricas</div>
              ) : (
                (() => {
                  const data = reliabilityQuery.data?.data?.data;
                  const stats = data?.stats || {};
                  const score = data?.reliabilityScore ?? 0;
                  const datasets = data?.datasets || [];
                  const actions = data?.recommendedActions || [];
                  const activeAlerts = data?.activeAlerts || data?.alerts?.filter((alert: any) => alert.active) || [];

                  return (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-foreground">Confiabilidad técnica</h3>
                          <p className="text-sm text-muted-foreground">Resumen de calidad de datos, estado y acciones recomendadas.</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Puntuación</div>
                          <div className="text-2xl font-bold text-primary">{score}%</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-border bg-background/70 p-4">
                          <div className="text-xs text-muted-foreground">Datasets</div>
                          <div className="text-lg font-semibold">{stats.totalDatasets || 0}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-background/70 p-4">
                          <div className="text-xs text-muted-foreground">Filas totales</div>
                          <div className="text-lg font-semibold">{stats.totalRows || 0}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-background/70 p-4">
                          <div className="text-xs text-muted-foreground">Tamaño total</div>
                          <div className="text-lg font-semibold">{(stats.totalSize || 0).toLocaleString()} bytes</div>
                        </div>
                      </div>

                      {activeAlerts.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                            <h4 className="text-sm font-semibold text-foreground">Alertas automáticas activas</h4>
                          </div>
                          <div className="space-y-3">
                            {activeAlerts.map((alert: any, index: number) => (
                              <div
                                key={`${alert.ruleId}-${index}`}
                                className={`rounded-xl border p-4 ${alert.severity === 'critical' ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className={`text-sm font-semibold ${alert.severity === 'critical' ? 'text-red-300' : 'text-amber-300'}`}>
                                      {alert.severity === 'critical' ? 'Crítica' : 'Advertencia'} · {alert.metric}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                                  </div>
                                  <div className="text-right text-xs text-muted-foreground">
                                    <div>Valor actual: {alert.currentValue}%</div>
                                    <div>Umbral: {alert.threshold}%</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl border border-border bg-background/70 p-4">
                        <h4 className="mb-2 text-sm font-semibold">Datasets</h4>
                        {datasets.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No hay datasets</div>
                        ) : (
                          <div className="space-y-3">
                            {datasets.map((d: any) => (
                              <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-card/70 p-2">
                                <div>
                                  <div className="font-medium text-foreground">{d.originalName}</div>
                                  <div className="text-xs text-muted-foreground">{d.rowCount} filas • {d.columnsCount} columnas • {d.nullableColumns} columnas nulas</div>
                                </div>
                                <div className="text-xs text-muted-foreground">{new Date(d.uploadedAt).toLocaleString()}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {actions.length > 0 && (
                        <div className="rounded-xl border border-border bg-card/80 p-4">
                          <h4 className="mb-2 text-sm font-semibold">Acciones recomendadas</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {actions.map((a: string, i: number) => (<li key={i}>{a}</li>))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
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
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white/10 p-1.5">
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
              <div className="space-y-4 px-6 py-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
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
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ctrl+Enter para generar • La IA elegirá las columnas más adecuadas del dataset
                  </p>
                </div>

                {/* Example prompts */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ejemplos rápidos</p>
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
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4">
                <button
                  onClick={() => { setShowCustomWidgetModal(false); setCustomWidgetPrompt(''); }}
                  disabled={generateWidgetMutation.isPending}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => generateWidgetMutation.mutate(customWidgetPrompt.trim())}
                  disabled={!customWidgetPrompt.trim() || generateWidgetMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
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
              className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
              style={{ maxHeight: '90vh' }}
            >
              {/* Modal header */}
              <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-muted/40 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <SparklesIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">{activeWidget.widget.title}</h2>
                    <p className="text-xs text-muted-foreground">Análisis inteligente con Gemini AI</p>
                  </div>
                </div>
                <button onClick={closeModal} className="rounded-lg p-1.5 transition-colors hover:bg-accent">
                  <XMarkIcon className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Body */}
              <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

                {/* Left: chart + data + downloads */}
                <div className="flex w-[45%] flex-col gap-4 overflow-y-auto border-r border-border p-5">

                  {/* Chart */}
                  <div ref={chartExportRef} className="rounded-xl border border-border bg-background/70 p-3">
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
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[9px] font-bold text-muted-foreground">X</span>
                        <span className="text-xs font-medium text-muted-foreground">{activeWidget.xKey}</span>
                        <div className="h-3 w-px bg-border" />
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[9px] font-bold text-primary">Y</span>
                        <span className="text-xs font-medium text-muted-foreground">{activeWidget.yKey}</span>
                        <span className="ml-auto rounded border border-border bg-background/60 px-2 py-0.5 text-[10px] capitalize text-muted-foreground">{activeWidget.chartType}</span>
                    </div>
                  )}

                  {/* Download */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descargar</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={downloadCSV} className="group flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background/60 p-3 transition-all hover:border-emerald-400/50 hover:bg-emerald-500/10">
                        <TableIcon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-emerald-400" />
                        <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-emerald-300">CSV</span>
                      </button>
                      <button onClick={downloadJSON} className="group flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background/60 p-3 transition-all hover:border-blue-400/50 hover:bg-blue-500/10">
                        <CodeBracketIcon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-blue-400" />
                        <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-blue-300">JSON</span>
                      </button>
                      <button onClick={downloadSVG} className="group flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background/60 p-3 transition-all hover:border-violet-400/50 hover:bg-violet-500/10">
                        <PhotoIcon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-violet-400" />
                        <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-violet-300">SVG</span>
                      </button>
                    </div>
                  </div>

                  {/* Data table */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos</p>
                    <div className="overflow-hidden rounded-xl border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="border-b border-border px-3 py-2 text-left font-semibold text-muted-foreground">{activeWidget.xKey}</th>
                            <th className="border-b border-border px-3 py-2 text-right font-semibold text-muted-foreground">{activeWidget.yKey}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {activeWidget.chartData.map((d, i) => (
                            <tr key={i} className="hover:bg-accent/50">
                              <td className="max-w-[120px] truncate px-3 py-1.5 font-medium text-foreground">{d.name}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{d.value.toLocaleString()}</td>
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
                  <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-border bg-muted/40 px-5 py-3">
                    <div className="rounded-lg bg-primary p-1.5">
                      <ChatBubbleLeftRightIcon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Analista IA</p>
                      <p className="text-[10px] text-muted-foreground">Consulta sobre este gráfico</p>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      En línea
                    </span>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-violet-500 to-blue-600 text-white'}`}>
                          {msg.role === 'user' ? 'T' : 'IA'}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-muted text-foreground'}`}>
                          {msg.role === 'ai' ? renderMarkdown(msg.text) : msg.text}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex gap-3">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600 text-xs font-bold text-white">IA</div>
                        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Suggested prompts */}
                  {chatHistory.length <= 1 && (
                    <div className="flex flex-wrap gap-1.5 px-5 pb-2">
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
                          className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input */}
                  <div className="flex-shrink-0 border-t border-border bg-card px-5 py-4">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                        placeholder="Pregunta sobre este gráfico... (Enter para enviar)"
                        rows={2}
                        className="flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        onClick={handleSendChat}
                        disabled={!chatInput.trim() || isChatLoading}
                        className="flex-shrink-0 rounded-xl bg-primary p-2.5 text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <PaperAirplaneIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <p className="mt-1.5 text-center text-[10px] text-muted-foreground">Respuestas generadas con Gemini AI · basadas en los datos reales</p>
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

function sanitizeHtmlForIframe(html: string): string {
  let safeHtml = html;

  // Remove active content and inline handlers from AI-generated HTML.
  safeHtml = safeHtml.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  safeHtml = safeHtml.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '');
  safeHtml = safeHtml.replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '');
  safeHtml = safeHtml.replace(/<embed[\s\S]*?>/gi, '');
  safeHtml = safeHtml.replace(/<link[\s\S]*?>/gi, '');
  safeHtml = safeHtml.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  safeHtml = safeHtml.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  safeHtml = safeHtml.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  safeHtml = safeHtml.replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"');
  safeHtml = safeHtml.replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, '$1="#"');

  return safeHtml;
}