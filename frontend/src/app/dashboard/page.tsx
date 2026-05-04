'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  PlusIcon,
  FolderIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CpuChipIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { projectsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ProjectStats } from '@/types';

type ProjectSummary = {
  _id: string;
  name: string;
  status?: string;
  stats?: ProjectStats;
};

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', { limit: 5 }],
    queryFn: () => projectsApi.getProjects({ limit: 5 }),
  });

  const projects: ProjectSummary[] = projectsData?.data?.data?.projects || [];
  const stats = {
    totalProjects: projectsData?.data?.data?.pagination?.total || 0,
    activeProjects: projects.filter((project) => project.status === 'ready').length,
    totalDatasets: projects.reduce((sum, project) => sum + (project.stats?.totalDatasets || 0), 0),
    totalRows: projects.reduce((sum, project) => sum + (project.stats?.totalRows || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 p-6 text-white shadow-lg shadow-indigo-950/10 dark:shadow-black/30">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              ¡Bienvenido, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-sky-100 mb-4">
              Transforma tus datos en insights poderosos con IA
            </p>
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center bg-white/95 text-indigo-700 px-4 py-2 rounded-lg font-medium hover:bg-white transition-colors shadow-sm"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Crear Nuevo Proyecto
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="w-32 h-32 rounded-full flex items-center justify-center bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
              <CpuChipIcon className="w-16 h-16 text-white/85" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            name: 'Total Proyectos',
            value: stats.totalProjects,
            icon: FolderIcon,
            color: 'bg-blue-500',
          },
          {
            name: 'Proyectos Activos',
            value: stats.activeProjects,
            icon: ChartBarIcon,
            color: 'bg-green-500',
          },
          {
            name: 'Datasets',
            value: stats.totalDatasets,
            icon: DocumentTextIcon,
            color: 'bg-purple-500',
          },
          {
            name: 'Filas de Datos',
            value: stats.totalRows.toLocaleString(),
            icon: CpuChipIcon,
            color: 'bg-orange-500',
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            className="bg-card/95 backdrop-blur-sm rounded-xl shadow-sm border border-border p-6"
          >
            <div className="flex items-center">
              <div className={`${stat.color} rounded-lg p-3`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Projects */}
      <div className="bg-card/95 backdrop-blur-sm rounded-xl shadow-sm border border-border">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Proyectos Recientes</h2>
            <Link
              href="/dashboard/projects"
              className="text-primary hover:text-primary/80 font-medium text-sm flex items-center"
            >
              Ver todos
              <ArrowRightIcon className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-muted rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="space-y-4">
              {projects.map((project) => (
                <motion.div
                  key={project._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FolderIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{project.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {project.stats?.totalDatasets || 0} datasets • {' '}
                        {project.stats?.totalRows || 0} filas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        project.status === 'ready'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : project.status === 'analyzing'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {project.status === 'ready' ? 'Listo' : 
                       project.status === 'analyzing' ? 'Analizando' : 'Borrador'}
                    </span>
                    <Link
                      href={`/dashboard/projects/${project._id}`}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      Ver proyecto
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No hay proyectos</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Comienza creando tu primer proyecto con datos.
              </p>
              <div className="mt-6">
                <Link
                  href="/dashboard/projects/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
                >
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Crear Proyecto
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            title: 'Crear Proyecto',
            description: 'Inicia un nuevo proyecto de análisis de datos',
            icon: PlusIcon,
            href: '/dashboard/projects/new',
            color: 'bg-primary',
          },
          {
            title: 'Ver Analytics',
            description: 'Explora tus dashboards y visualizaciones',
            icon: ChartBarIcon,
            href: '/dashboard/analytics',
            color: 'bg-emerald-500',
          },
          {
            title: 'Documentación',
            description: 'Accede a guías y documentación técnica',
            icon: DocumentTextIcon,
            href: '/dashboard/docs',
            color: 'bg-violet-500',
          },
        ].map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
          >
            <Link
              href={action.href}
              className="block bg-card/95 backdrop-blur-sm rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className={`${action.color} rounded-lg p-3`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-foreground">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}