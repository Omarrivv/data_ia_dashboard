'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  BookOpenIcon,
  CloudArrowUpIcon,
  CpuChipIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  LightBulbIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

const sections = [
  {
    icon: CloudArrowUpIcon,
    color: 'bg-blue-50 text-blue-600 border-blue-100',
    title: 'Crear un proyecto',
    steps: [
      'Ve a Proyectos → Nuevo Proyecto.',
      'Escribe un nombre y descripción para tu proyecto.',
      'Sube tu dataset en formato CSV, JSON o Excel (máx. 10 MB).',
      'Haz clic en "Crear Proyecto" y espera a que se procese.',
    ],
  },
  {
    icon: TableCellsIcon,
    color: 'bg-violet-50 text-violet-600 border-violet-100',
    title: 'Gestionar datasets',
    steps: [
      'Abre un proyecto y ve a la pestaña "Datasets".',
      'Haz clic en "Agregar Dataset" para subir archivos adicionales.',
      'Cada dataset muestra nombre, tamaño, número de filas y columnas.',
      'Puedes eliminar un dataset con el botón de papelera.',
    ],
  },
  {
    icon: CpuChipIcon,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    title: 'Análisis con IA',
    steps: [
      'Con al menos un dataset cargado, ve a la pestaña "Análisis".',
      'Haz clic en "Analizar con IA" para iniciar el análisis con Gemini.',
      'El proceso puede tardar unos segundos dependiendo del tamaño.',
      'El resultado incluye KPIs, gráficas y texto descriptivo.',
    ],
  },
  {
    icon: DocumentTextIcon,
    color: 'bg-amber-50 text-amber-600 border-amber-100',
    title: 'Documentación técnica',
    steps: [
      'Ve a la pestaña "Documentación" dentro del proyecto.',
      'Haz clic en "Generar Documentación" para crear el informe.',
      'El informe incluye resumen ejecutivo, estructura de datos y recomendaciones.',
      'Usa el índice lateral para navegar entre secciones.',
    ],
  },
  {
    icon: ChartBarIcon,
    color: 'bg-rose-50 text-rose-600 border-rose-100',
    title: 'Dashboard interactivo',
    steps: [
      'Una vez analizado, ve a la pestaña "Dashboard".',
      'Verás gráficas generadas automáticamente por la IA.',
      'Los widgets disponibles son: barras, líneas, área, pastel y KPIs.',
      'Puedes navegar entre los distintos gráficos del análisis.',
    ],
  },
  {
    icon: LightBulbIcon,
    color: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    title: 'Consejos útiles',
    steps: [
      'Usa archivos CSV con encabezados claros para mejores resultados.',
      'Las columnas de tipo fecha deben estar en formato ISO (YYYY-MM-DD).',
      'Proyectos con más de 1,000 filas generan análisis más precisos.',
      'Puedes re-analizar el proyecto en cualquier momento con nuevos datasets.',
    ],
  },
];

const formats = [
  { ext: 'CSV', desc: 'Comma-separated values', ok: true },
  { ext: 'JSON', desc: 'Array de objetos planos', ok: true },
  { ext: 'XLSX', desc: 'Excel (primera hoja)', ok: true },
  { ext: 'XLS', desc: 'Excel antiguo', ok: true },
  { ext: 'PDF', desc: 'No soportado', ok: false },
  { ext: 'DOCX', desc: 'No soportado', ok: false },
];

export default function DocsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documentación</h1>
        <p className="text-gray-500 text-sm mt-1">Guía rápida para usar la plataforma</p>
      </div>

      {/* Intro card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl p-6 text-white shadow-md"
      >
        <div className="flex items-start gap-4">
          <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
            <BookOpenIcon className="h-7 w-7 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Plataforma de análisis de datos con IA</h2>
            <p className="text-blue-100 text-sm mt-1">
              Sube tus datasets, genera análisis automático con Gemini AI y obtén dashboards,
              documentación técnica y recomendaciones en segundos.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Guide sections */}
      <div className="grid gap-4">
        {sections.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg border ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
            </div>
            <ol className="space-y-2">
              {s.steps.map((step, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-gray-600">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </motion.div>
        ))}
      </div>

      {/* Formats table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Formatos de archivo soportados</h3>
        <div className="divide-y divide-gray-50">
          {formats.map((f) => (
            <div key={f.ext} className="flex items-center gap-3 py-2.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono ${f.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                .{f.ext}
              </span>
              <span className="text-sm text-gray-600 flex-1">{f.desc}</span>
              {f.ok ? (
                <span className="text-xs text-emerald-600 font-medium">Soportado</span>
              ) : (
                <span className="text-xs text-gray-400">No disponible</span>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gray-50 rounded-xl border border-gray-200 p-5 flex items-center justify-between"
      >
        <div>
          <p className="text-sm font-semibold text-gray-800">¿Listo para empezar?</p>
          <p className="text-xs text-gray-500 mt-0.5">Crea tu primer proyecto y analiza tus datos en minutos.</p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          Crear proyecto
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  );
}
