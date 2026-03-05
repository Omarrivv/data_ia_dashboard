'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  FolderIcon,
  DocumentTextIcon,
  TableCellsIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { projectsApi } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  ready: '#22c55e',
  processing: '#3b82f6',
  pending: '#f59e0b',
  error: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  ready: 'Listo',
  processing: 'Procesando',
  pending: 'Pendiente',
  error: 'Error',
};

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['projects', { limit: 100 }],
    queryFn: () => projectsApi.getProjects({ limit: 100 }),
  });

  const projects: any[] = data?.data?.data?.projects || [];

  // Stats
  const totalProjects = projects.length;
  const totalDatasets = projects.reduce((s: number, p: any) => s + (p.stats?.totalDatasets || 0), 0);
  const totalRows = projects.reduce((s: number, p: any) => s + (p.stats?.totalRows || 0), 0);
  const analyzedProjects = projects.filter((p: any) => p.dashboard).length;

  // Status distribution for pie
  const statusCount: Record<string, number> = {};
  projects.forEach((p: any) => {
    statusCount[p.status] = (statusCount[p.status] || 0) + 1;
  });
  const statusData = Object.entries(statusCount).map(([key, value]) => ({
    name: STATUS_LABELS[key] || key,
    value,
    color: STATUS_COLORS[key] || '#94a3b8',
  }));

  // Datasets per project (top 8)
  const datasetsBar = [...projects]
    .sort((a, b) => (b.stats?.totalDatasets || 0) - (a.stats?.totalDatasets || 0))
    .slice(0, 8)
    .map((p: any) => ({
      name: p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name,
      datasets: p.stats?.totalDatasets || 0,
      filas: p.stats?.totalRows || 0,
    }));

  // Projects created by month (last 6 months)
  const monthlyMap: Record<string, number> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
    monthlyMap[key] = 0;
  }
  projects.forEach((p: any) => {
    const d = new Date(p.createdAt);
    const key = d.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
    if (key in monthlyMap) monthlyMap[key]++;
  });
  const monthlyData = Object.entries(monthlyMap).map(([mes, proyectos]) => ({ mes, proyectos }));

  const stats = [
    { label: 'Proyectos totales', value: totalProjects, icon: FolderIcon, bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
    { label: 'Datasets subidos', value: totalDatasets, icon: DocumentTextIcon, bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
    { label: 'Filas procesadas', value: totalRows.toLocaleString('es-ES'), icon: TableCellsIcon, bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
    { label: 'Con análisis IA', value: analyzedProjects, icon: ChartBarIcon, bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen de actividad y uso de la plataforma</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`bg-white rounded-xl border ${s.border} p-5 shadow-sm`}
          >
            <div className={`inline-flex items-center justify-center w-10 h-10 ${s.bg} rounded-lg mb-3`}>
              <s.icon className={`h-5 w-5 ${s.text}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly line chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5"
        >
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Proyectos creados por mes</h2>
          {monthlyData.every((d) => d.proyectos === 0) ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sin datos suficientes</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="proyectos" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} name="Proyectos" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Status pie */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
        >
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Estado de proyectos</h2>
          {statusData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sin proyectos</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} proyectos`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {statusData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span>{d.name}</span>
                    <span className="ml-auto font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Datasets bar chart */}
      {datasetsBar.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
        >
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Datasets por proyecto</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={datasetsBar} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="datasets" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Datasets" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {totalProjects === 0 && (
        <div className="text-center py-20 text-gray-400">
          <ChartBarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Crea proyectos para ver estadísticas aquí</p>
        </div>
      )}
    </div>
  );
}
