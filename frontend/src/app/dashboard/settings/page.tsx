'use client';

import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  BellIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${checked ? 'bg-primary' : 'bg-muted'}`}
      aria-pressed={checked}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );
}

const notificationItems = [
  { key: 'projectReady', label: 'Proyecto listo para usar', desc: 'Cuando el procesamiento inicial termina' },
  { key: 'analysisComplete', label: 'Análisis de IA completado', desc: 'Al finalizar el análisis con Gemini' },
  { key: 'weeklyReport', label: 'Reporte semanal', desc: 'Resumen de actividad cada lunes' },
  { key: 'errorAlerts', label: 'Alertas de error', desc: 'Si un proceso falla o hay errores' },
] as const;

const privacyItems = [
  { key: 'shareAnalytics', label: 'Compartir datos de uso anónimos', desc: 'Ayuda a mejorar la plataforma' },
  { key: 'publicProfile', label: 'Perfil público', desc: 'Otros usuarios pueden ver tu perfil' },
] as const;

const quickSteps = [
  { label: '1. Ajusta notificaciones', hint: 'Decide qué eventos quieres seguir.' },
  { label: '2. Revisa privacidad', hint: 'Controla qué información compartes.' },
  { label: '3. Define región', hint: 'Idioma y zona horaria para trabajar cómodo.' },
];

function SectionCard({
  title,
  description,
  icon: Icon,
  accent,
  children,
  index,
  defaultOpen = false,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  accent: string;
  children: React.ReactNode;
  index: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * index }} className="overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/50"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <ChevronDownIcon className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </motion.section>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState({
    projectReady: true,
    analysisComplete: true,
    weeklyReport: false,
    errorAlerts: true,
  });
  const [privacy, setPrivacy] = useState({
    shareAnalytics: false,
    publicProfile: false,
  });
  const [lang, setLang] = useState('es');
  const [timezone, setTimezone] = useState('America/Lima');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function saveSection(label: string) {
    toast.success(`${label} guardado`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 p-6 text-white shadow-lg shadow-indigo-950/10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
              <SparklesIcon className="h-4 w-4" />
              Ajustes guiados
            </div>
            <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Configuración</h1>
            <p className="mt-2 text-sm text-sky-100 sm:text-base">
              Cambia tus preferencias por bloques, sin llenar la pantalla de texto. Haz clic en cada sección para revisar solo lo necesario.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
            {quickSteps.map((step) => (
              <div key={step.label} className="rounded-2xl bg-white/10 p-4 text-sm backdrop-blur-sm ring-1 ring-white/15">
                <p className="font-semibold text-white">{step.label}</p>
                <p className="mt-1 text-xs text-sky-100">{step.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <ShieldCheckIcon className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Cómo usar esta página</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cada bloque se abre para mostrar las opciones. Primero mira el resumen, luego ajusta y guarda.
            </p>
          </div>
        </div>
      </motion.div>

      <SectionCard
        title="Notificaciones"
        description="Elige qué eventos quieres recibir y cuáles no."
        icon={BellIcon}
        accent="bg-primary/10 text-primary border-primary/20"
        index={0}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Qué vas a controlar</p>
            <p className="mt-1">Notificaciones de proyectos, análisis, reportes y fallos del sistema.</p>
          </div>

          <div className="space-y-4">
            {notificationItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Toggle
                  checked={notifs[item.key]}
                  onChange={(value) => setNotifs((current) => ({ ...current, [item.key]: value }))}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm text-foreground">Guarda cuando termines para mantener tus preferencias activas.</p>
            <button onClick={() => saveSection('Notificaciones')} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
              Guardar
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Privacidad"
        description="Decide qué información compartes y qué permanece privada."
        icon={ShieldCheckIcon}
        accent="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        index={1}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Tu control de datos</p>
            <p className="mt-1">Estos ajustes afectan analítica interna y visibilidad de perfil.</p>
          </div>

          <div className="space-y-4">
            {privacyItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Toggle
                  checked={privacy[item.key]}
                  onChange={(value) => setPrivacy((current) => ({ ...current, [item.key]: value }))}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <p className="text-sm text-foreground">Puedes ajustar estos valores cuando quieras.</p>
            <button onClick={() => saveSection('Privacidad')} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
              Guardar
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Idioma y región"
        description="Define el idioma y la zona horaria de trabajo."
        icon={GlobeAltIcon}
        accent="bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
        index={2}
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="block text-sm font-medium text-foreground">Idioma de la interfaz</span>
              <select
                value={lang}
                onChange={(event) => setLang(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="block text-sm font-medium text-foreground">Zona horaria</span>
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="America/Lima">América/Lima (GMT-5)</option>
                <option value="America/Bogota">América/Bogotá (GMT-5)</option>
                <option value="America/Mexico_City">América/Ciudad de México (GMT-6)</option>
                <option value="America/Argentina/Buenos_Aires">América/Buenos Aires (GMT-3)</option>
                <option value="Europe/Madrid">Europa/Madrid (GMT+1)</option>
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Consejo</p>
            <p className="mt-1">La zona horaria hace que fechas, reportes y actividad se muestren correctamente para tu país.</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
            <p className="text-sm text-foreground">Idioma actual: {lang === 'es' ? 'Español' : 'English'}</p>
            <button onClick={() => saveSection('Idioma y región')} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
              Guardar
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Zona de peligro"
        description="Acciones críticas que requieren más cuidado."
        icon={ExclamationTriangleIcon}
        accent="bg-rose-500/10 text-rose-600 border-rose-500/20"
        index={3}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Antes de continuar</p>
            <p className="mt-1">Esta acción es irreversible. Solo elimínala si estás seguro.</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Eliminar cuenta</p>
              <p className="text-xs text-muted-foreground">Se borrarán proyectos, datasets y análisis.</p>
            </div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-500/20 bg-background px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-500/10 dark:text-rose-300"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>

          {confirmDelete && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
              <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                ¿Estás seguro? Se eliminarán todos tus proyectos, datasets y análisis.
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => toast.error('Función no disponible en esta versión')}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-700"
                >
                  Sí, eliminar mi cuenta
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </SectionCard>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">¿Quieres revisar el resto de la plataforma?</p>
            <p className="mt-1 text-xs text-muted-foreground">También puedes volver al dashboard principal para continuar.</p>
          </div>
          <a href="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90">
            Ir al dashboard
            <ArrowRightIcon className="h-4 w-4" />
          </a>
        </div>
      </motion.div>
    </div>
  );
}
