'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ShieldCheckIcon, FunnelIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { AuditLogEntry } from '@/types';

const ACTION_LABELS: Record<string, string> = {
  'auth.register': 'Registro',
  'auth.login': 'Inicio de sesión',
  'auth.logout': 'Cierre de sesión',
  'project.create': 'Crear proyecto',
  'project.update': 'Actualizar proyecto',
  'project.delete': 'Eliminar proyecto',
  'project.analyze.requested': 'Analizar proyecto',
  'dataset.upload': 'Subir dataset',
  'dataset.delete': 'Eliminar dataset',
};

export default function AuditPage() {
  const { user, isLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const limit = 20;

  const isAdmin = user?.role === 'admin';

  const summaryQuery = useQuery({
    queryKey: ['admin', 'audit-summary'],
    queryFn: () => adminApi.getAuditSummary(),
    enabled: isAdmin,
  });

  const logsQuery = useQuery({
    queryKey: ['admin', 'audit-logs', page, action, resourceType],
    queryFn: () => adminApi.getAuditLogs({ page, limit, action: action || undefined, resourceType: resourceType || undefined }),
    enabled: isAdmin,
    placeholderData: (previousData) => previousData,
  });

  const entries: AuditLogEntry[] = logsQuery.data?.data?.data?.entries || [];
  const pagination = logsQuery.data?.data?.data?.pagination;
  const summary = summaryQuery.data?.data?.data;

  const actions = summary?.actions || [];

  if (isLoading) {
    return <div className="text-sm text-gray-500">Cargando sesión...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center">
            <ShieldCheckIcon className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Acceso restringido</h1>
            <p className="text-sm text-gray-500">Esta sección solo está disponible para administradores.</p>
          </div>
        </div>
        <Link href="/dashboard" className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Volver al dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>
          <p className="text-gray-600">Registro de actividad y acciones críticas del sistema.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            summaryQuery.refetch();
            logsQuery.refetch();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Logs totales</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{summary?.totalLogs ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Eventos recientes</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{summary?.recentLogs?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Acciones distintas</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{actions.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <FunnelIcon className="h-4 w-4 text-gray-500" />
          Filtros
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={resourceType}
            onChange={(e) => {
              setResourceType(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Todos los recursos</option>
            <option value="user">Usuarios</option>
            <option value="project">Proyectos</option>
          </select>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="rounded-full bg-gray-100 px-3 py-1">MongoDB existente</span>
            <span className="rounded-full bg-gray-100 px-3 py-1">sin DB nueva</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Eventos de auditoría</h2>
        </div>

        {logsQuery.isLoading ? (
          <div className="p-6 text-sm text-gray-500">Cargando eventos...</div>
        ) : entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Acción</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Recurso</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {entries.map((entry) => (
                  <tr key={entry._id}>
                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{ACTION_LABELS[entry.action] || entry.action}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.resourceType}
                      {entry.resourceId ? <span className="ml-2 text-xs text-gray-400">{entry.resourceId}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.userId || 'Sistema'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${entry.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {entry.success ? 'OK' : 'Error'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-gray-500">No hay eventos con esos filtros.</div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-4 text-sm text-gray-600">
            <span>
              Página {pagination.page} de {pagination.pages} · {pagination.total} eventos
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= pagination.pages}
                onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
                className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}