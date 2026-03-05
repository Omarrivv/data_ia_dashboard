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

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', { limit: 5 }],
    queryFn: () => projectsApi.getProjects({ limit: 5 }),
  });

  const projects = projectsData?.data?.data?.projects || [];
  const stats = {
    totalProjects: projectsData?.data?.data?.pagination?.total || 0,
    activeProjects: projects.filter((p: any) => p.status === 'ready').length,
    totalDatasets: projects.reduce((sum: number, p: any) => sum + (p.stats?.totalDatasets || 0), 0),
    totalRows: projects.reduce((sum: number, p: any) => sum + (p.stats?.totalRows || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              ¡Bienvenido, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-blue-100 mb-4">
              Transforma tus datos en insights poderosos con IA
            </p>
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Crear Nuevo Proyecto
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center">
              <CpuChipIcon className="w-16 h-16 text-white/80" />
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
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center">
              <div className={`${stat.color} rounded-lg p-3`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Proyectos Recientes</h2>
            <Link
              href="/dashboard/projects"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center"
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
                    <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="space-y-4">
              {projects.map((project: any) => (
                <motion.div
                  key={project._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FolderIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{project.name}</h3>
                      <p className="text-sm text-gray-500">
                        {project.stats?.totalDatasets || 0} datasets • {' '}
                        {project.stats?.totalRows || 0} filas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        project.status === 'ready'
                          ? 'bg-green-100 text-green-800'
                          : project.status === 'analyzing'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
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
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay proyectos</h3>
              <p className="mt-1 text-sm text-gray-500">
                Comienza creando tu primer proyecto con datos.
              </p>
              <div className="mt-6">
                <Link
                  href="/dashboard/projects/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
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
            color: 'bg-blue-500',
          },
          {
            title: 'Ver Analytics',
            description: 'Explora tus dashboards y visualizaciones',
            icon: ChartBarIcon,
            href: '/dashboard/analytics',
            color: 'bg-green-500',
          },
          {
            title: 'Documentación',
            description: 'Accede a guías y documentación técnica',
            icon: DocumentTextIcon,
            href: '/dashboard/docs',
            color: 'bg-purple-500',
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
              className="block bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className={`${action.color} rounded-lg p-3`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">{action.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{action.description}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}