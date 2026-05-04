'use client';

import { Disclosure } from '@headlessui/react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  ChartBarIcon,
  ChevronDownIcon,
  CloudArrowUpIcon,
  CpuChipIcon,
  DocumentTextIcon,
  LightBulbIcon,
  SparklesIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

const sections = [
  {
    icon: CloudArrowUpIcon,
    color: 'bg-primary/10 text-primary border-primary/20',
    title: 'Crear un proyecto',
    summary: 'Empieza aquí si estás cargando tus primeros datos.',
    steps: [
      'Ve a Proyectos → Nuevo Proyecto.',
      'Escribe un nombre y descripción para tu proyecto.',
      'Sube tu dataset en formato CSV, JSON o Excel (máx. 10 MB).',
      'Haz clic en Crear Proyecto y espera a que se procese.',
    ],
    outcome: 'Tendrás un proyecto listo para recibir análisis y visualizaciones.',
  },
  {
    icon: TableCellsIcon,
    color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    title: 'Gestionar datasets',
    summary: 'Cómo mantener ordenados los archivos dentro de cada proyecto.',
    steps: [
      'Abre un proyecto y ve a la pestaña Datasets.',
      'Haz clic en Agregar Dataset para subir archivos adicionales.',
      'Cada dataset muestra nombre, tamaño, filas y columnas.',
      'Puedes eliminar un dataset con el botón de papelera.',
    ],
    outcome: 'Vas a poder trabajar con varias fuentes sin perder contexto.',
  },
  {
    icon: CpuChipIcon,
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    title: 'Análisis con IA',
    summary: 'El flujo principal para convertir datos en insights.',
    steps: [
      'Con al menos un dataset cargado, ve a la pestaña Análisis.',
      'Haz clic en Analizar con IA para iniciar el procesamiento con Gemini.',
      'El proceso puede tardar unos segundos dependiendo del tamaño.',
      'El resultado incluye KPIs, gráficas y texto descriptivo.',
    ],
    outcome: 'Obtendrás un resumen visual y textual para interpretar rápido.',
  },
  {
    icon: DocumentTextIcon,
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    title: 'Documentación técnica',
    summary: 'Una explicación clara de lo que el sistema encontró.',
    steps: [
      'Ve a la pestaña Documentación dentro del proyecto.',
      'Haz clic en Generar Documentación para crear el informe.',
      'El informe incluye resumen ejecutivo, estructura de datos y recomendaciones.',
      'Usa el índice lateral para navegar entre secciones.',
    ],
    outcome: 'Tendrás un documento útil para compartir con tu equipo o cliente.',
  },
  {
    icon: ChartBarIcon,
    color: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    title: 'Dashboard interactivo',
    summary: 'La vista más visual para explorar métricas y tendencias.',
    steps: [
      'Una vez analizado, ve a la pestaña Dashboard.',
      'Verás gráficas generadas automáticamente por la IA.',
      'Los widgets disponibles son: barras, líneas, área, pastel y KPIs.',
      'Puedes navegar entre los distintos gráficos del análisis.',
    ],
    outcome: 'Explorarás patrones sin leer mucho texto técnico.',
  },
  {
    icon: LightBulbIcon,
    color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    title: 'Consejos útiles',
    summary: 'Detalles que mejoran la calidad del análisis desde el inicio.',
    steps: [
      'Usa archivos CSV con encabezados claros para mejores resultados.',
      'Las columnas de tipo fecha deben estar en formato ISO (YYYY-MM-DD).',
      'Proyectos con más de 1,000 filas generan análisis más precisos.',
      'Puedes re-analizar el proyecto en cualquier momento con nuevos datasets.',
    ],
    outcome: 'La IA entiende mejor tu información y devuelve respuestas más útiles.',
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

const quickPath = [
  { label: '1. Crea un proyecto', hint: 'Define nombre, descripción y sube tu archivo.' },
  { label: '2. Lanza el análisis', hint: 'IA genera KPIs, widgets y recomendaciones.' },
  { label: '3. Lee la guía', hint: 'Abre cada bloque para seguir el flujo paso a paso.' },
];

function GuideCard({
  title,
  summary,
  steps,
  outcome,
  icon: Icon,
  color,
  index,
}: {
  title: string;
  summary: string;
  steps: string[];
  outcome: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  index: number;
}) {
  return (
    <Disclosure as={motion.div} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * index }} className="overflow-hidden rounded-2xl border border-border bg-card/95 backdrop-blur-sm shadow-sm">
      {({ open }) => (
        <>
          <Disclosure.Button className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${color} shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <span className="hidden sm:inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Haz clic
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
              </div>
            </div>
            <ChevronDownIcon className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </Disclosure.Button>

          <Disclosure.Panel className="border-t border-border px-5 py-4">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
                <SparklesIcon className="h-3.5 w-3.5 text-primary" />
                Lectura guiada
              </span>
              <span>La sección está pensada para leerse en orden.</span>
            </div>

            <ol className="space-y-2">
              {steps.map((step, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {idx + 1}
                  </span>
                  <span className="leading-6">{step}</span>
                </li>
              ))}
            </ol>

            <div className="mt-4 rounded-xl border border-border bg-background/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resultado esperado</p>
              <p className="mt-1 text-sm text-foreground">{outcome}</p>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 p-6 text-white shadow-lg shadow-indigo-950/10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
              <BookOpenIcon className="h-4 w-4" />
              Guía paso a paso
            </div>
            <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Documentación</h1>
            <p className="mt-2 text-sm text-sky-100 sm:text-base">
              Abre cada bloque para leer solo lo importante, en el orden correcto, sin sentir la pantalla pesada.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
            {quickPath.map((item) => (
              <div key={item.label} className="rounded-2xl bg-white/10 p-4 text-sm backdrop-blur-sm ring-1 ring-white/15">
                <p className="font-semibold text-white">{item.label}</p>
                <p className="mt-1 text-xs text-sky-100">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm backdrop-blur-sm">
          <h2 className="text-base font-semibold text-foreground">Cómo usar esta guía</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Elige una sección, haz clic para desplegarla y avanza paso a paso. La idea es reducir ruido visual y que tu atención vaya directo a la acción.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <CpuChipIcon className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Formato recomendado</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            CSV limpio, columnas claras y pocas columnas vacías ayudan a que la lectura sea más rápida y útil.
          </p>
        </motion.div>
      </div>

      <div className="grid gap-4">
        {sections.map((section, index) => (
          <GuideCard key={section.title} {...section} index={index} />
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Formatos de archivo soportados</h3>
        </div>
        <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {formats.map((format) => (
            <div key={format.ext} className="flex items-center gap-3 bg-background/40 px-4 py-3">
              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold font-mono ${format.ok ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                .{format.ext}
              </span>
              <span className="flex-1 text-sm text-muted-foreground">{format.desc}</span>
              {format.ok ? (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-300">Soportado</span>
              ) : (
                <span className="text-xs text-muted-foreground">No disponible</span>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-col gap-4 rounded-2xl border border-border bg-card/95 p-5 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">¿Listo para empezar?</p>
          <p className="mt-1 text-xs text-muted-foreground">Crea tu primer proyecto y sigue la guía en el orden recomendado.</p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90"
        >
          Crear proyecto
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  );
}
