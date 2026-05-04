'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  PlusIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import { projectsApi } from '@/lib/api';
import { Menu } from '@headlessui/react';
import clsx from 'clsx';
import type { ProjectStats } from '@/types';

type ProjectCard = {
  _id: string;
  name: string;
  description?: string;
  status?: string;
  createdAt: string | Date;
  stats?: ProjectStats;
};

export default function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', { page, limit, search, status: statusFilter }],
    queryFn: () => projectsApi.getProjects({ 
      page, 
      limit, 
      search: search || undefined,
      status: statusFilter || undefined 
    }),
  });

  const projects: ProjectCard[] = projectsData?.data?.data?.projects || [];
  const pagination = projectsData?.data?.data?.pagination;

  const statusOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'draft', label: 'Borrador' },
    { value: 'analyzing', label: 'Analizando' },
    { value: 'ready', label: 'Listo' },
    { value: 'error', label: 'Error' },
  ];

  const getStatusColor = (status?: string) => {
    const normalizedStatus = status ?? 'draft';

    switch (normalizedStatus) {
      case 'ready':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
      case 'analyzing':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
      case 'error':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status?: string) => {
    const normalizedStatus = status ?? 'draft';

    switch (normalizedStatus) {
      case 'ready':
        return 'Listo';
      case 'analyzing':
        return 'Analizando';
      case 'error':
        return 'Error';
      default:
        return 'Borrador';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Proyectos</h1>
          <p className="text-muted-foreground">Gestiona tus proyectos de análisis de datos</p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Nuevo Proyecto
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-card/95 backdrop-blur-sm rounded-xl shadow-sm border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar proyectos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card/95 backdrop-blur-sm rounded-xl shadow-sm border border-border p-6 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-muted rounded-lg"></div>
                <div className="w-6 h-6 bg-muted rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="h-6 bg-muted rounded w-16"></div>
                <div className="h-8 bg-muted rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      ) : projects.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <motion.div
                key={project._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-card/95 backdrop-blur-sm rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <FolderIcon className="w-6 h-6 text-primary" />
                  </div>
                  <Menu as="div" className="relative">
                    <Menu.Button className="p-1 rounded-full hover:bg-accent">
                      <EllipsisVerticalIcon className="w-5 h-5 text-muted-foreground" />
                    </Menu.Button>
                    <Menu.Items className="absolute right-0 mt-2 w-48 bg-card/95 backdrop-blur-sm rounded-md shadow-lg ring-1 ring-border focus:outline-none z-10 overflow-hidden">
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            href={`/dashboard/projects/${project._id}`}
                            className={clsx(
                              active ? 'bg-accent' : '',
                              'block px-4 py-2 text-sm text-foreground'
                            )}
                          >
                            Ver proyecto
                          </Link>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            href={`/dashboard/projects/${project._id}/edit`}
                            className={clsx(
                              active ? 'bg-accent' : '',
                              'block px-4 py-2 text-sm text-foreground'
                            )}
                          >
                            Editar
                          </Link>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Menu>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {project.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description || 'Sin descripción'}
                  </p>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      project.status
                    )}`}
                  >
                    {getStatusLabel(project.status)}
                  </span>
                  <div className="text-sm text-muted-foreground">
                    {project.stats?.totalDatasets || 0} datasets
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                  <Link
                    href={`/dashboard/projects/${project._id}`}
                    className="text-primary hover:text-primary/80 font-medium text-sm"
                  >
                    Ver proyecto →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-foreground">
                Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                {pagination.total} proyectos
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-2 text-sm font-medium text-muted-foreground bg-card border border-border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="px-3 py-2 text-sm font-medium text-foreground">
                  Página {page} de {pagination.pages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.pages}
                  className="px-3 py-2 text-sm font-medium text-muted-foreground bg-card border border-border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <FolderIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-foreground">No hay proyectos</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter
              ? 'No se encontraron proyectos con los filtros aplicados.'
              : 'Comienza creando tu primer proyecto con datos.'}
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
  );
}