'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  DocumentArrowUpIcon,
  FolderIcon,
  PlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  XMarkIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { projectsApi, uploadApi } from '@/lib/api';
import type { ProjectDomain } from '@/types';

const ONBOARDING_KEY = 'first-project-onboarding-completed';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const createProjectSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200, 'Máximo 200 caracteres'),
  description: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
  domain: z.enum(['sales', 'marketing', 'finance', 'operations', 'custom']).default('sales'),
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

type ProjectTemplate = {
  id: ProjectDomain;
  label: string;
  name: string;
  description: string;
  hint: string;
};

const projectTemplates: ProjectTemplate[] = [
  {
    id: 'sales',
    label: 'Ventas',
    name: 'Análisis de Ventas',
    description: 'Seguimiento de ingresos, conversión, ticket promedio y tendencias comerciales.',
    hint: 'Ideal para equipos comerciales y e-commerce',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    name: 'Panel de Marketing',
    description: 'Campañas, tráfico, conversiones y rendimiento por canal.',
    hint: 'Útil para growth y performance marketing',
  },
  {
    id: 'operations',
    label: 'Operaciones',
    name: 'Control Operativo',
    description: 'Seguimiento de procesos, tiempos, eficiencia y alertas operativas.',
    hint: 'Pensado para operaciones y analítica interna',
  },
  {
    id: 'finance',
    label: 'Finanzas',
    name: 'Tablero Financiero',
    description: 'Ingresos, costos, margen y liquidez para decisiones ejecutivas.',
    hint: 'Pensado para control financiero y dirección',
  },
];

const stepLabels = [
  { id: 1, title: 'Contexto', description: 'Elige plantilla y define el proyecto' },
  { id: 2, title: 'Datos', description: 'Sube tu archivo o déjalo para después' },
  { id: 3, title: 'Revisión', description: 'Confirma y crea el proyecto' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectDomain | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<ProjectDomain>('sales');
  const [activeStep, setActiveStep] = useState(1);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const { data: projectsData, isLoading: isProjectsLoading } = useQuery({
    queryKey: ['projects', { page: 1, limit: 1 }],
    queryFn: () => projectsApi.getProjects({ page: 1, limit: 1 }),
  });

  const totalProjects = projectsData?.data?.data?.pagination?.total ?? 0;
  const isFirstProject = !isProjectsLoading && totalProjects === 0;
  const showOnboarding = isFirstProject && !hasCompletedOnboarding;

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      description: '',
      domain: 'sales',
    },
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHasCompletedOnboarding(window.localStorage.getItem(ONBOARDING_KEY) === '1');
  }, []);

  useEffect(() => {
    if (showOnboarding) {
      setActiveStep(1);
    }
  }, [showOnboarding]);

  const completeOnboarding = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_KEY, '1');
    }
    setHasCompletedOnboarding(true);
  }, []);

  const applyTemplate = useCallback((template: ProjectTemplate) => {
    setSelectedTemplate(template.id);
    setSelectedDomain(template.id);
    setValue('domain', template.id, { shouldDirty: true, shouldTouch: true });
    setValue('name', template.name, { shouldDirty: true, shouldTouch: true });
    setValue('description', template.description, { shouldDirty: true, shouldTouch: true });
  }, [setValue]);

  const onSubmit = useCallback((data: CreateProjectFormData) => {
    createProjectMutation.mutate({
      name: data.name,
      description: data.description ?? '',
      domain: data.domain,
    });
  }, []);

  const createProjectMutation = useMutation({
    mutationFn: projectsApi.createProject,
    onSuccess: async (response) => {
      if (!response.data.success) {
        toast.error(response.data.message || 'No se pudo crear el proyecto');
        return;
      }

      const createdProject = response.data.data;
      if (!createdProject) {
        toast.error('El proyecto se creó, pero no se pudo leer su identificador');
        return;
      }

      const projectId = createdProject._id;
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      if (selectedFile) {
        try {
          await uploadApi.uploadFile(projectId, selectedFile, setUploadProgress);
          toast.success('Proyecto creado y dataset subido correctamente');
        } catch {
          toast.error('Proyecto creado, pero hubo un error al subir el archivo');
        }
      } else {
        toast.success('Proyecto creado exitosamente');
      }

      if (showOnboarding) {
        completeOnboarding();
      }

      router.push(`/dashboard/projects/${projectId}`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Error al crear el proyecto';
      toast.error(message);
    },
  });

  const isLoading = createProjectMutation.isPending;

  const handleFileSelect = useCallback((file: File) => {
    const allowed = [
      'text/csv',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowed.includes(file.type) && !file.name.match(/\.(csv|json|xlsx|xls)$/i)) {
      toast.error('Solo se aceptan archivos CSV, JSON o Excel');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('El archivo no puede superar 10 MB');
      return;
    }

    setSelectedFile(file);
    setUploadProgress(0);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const goNext = async () => {
    if (activeStep === 1) {
      const valid = await trigger(['name', 'description', 'domain']);
      if (!valid) return;
    }
    setActiveStep((prev) => Math.min(3, prev + 1));
  };

  const goBack = () => setActiveStep((prev) => Math.max(1, prev - 1));

  const skipOnboarding = () => {
    completeOnboarding();
    toast.success('Guía completada. Puedes usar el formulario libremente.');
  };

  const renderTemplateCards = () => (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {projectTemplates.map((template) => {
        const active = selectedTemplate === template.id;
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => applyTemplate(template)}
            className={`text-left rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm ${active ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background hover:bg-accent/50'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">{template.label}</span>
              {active && <CheckCircleIcon className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-sm font-medium text-foreground">{template.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{template.hint}</p>
          </button>
        );
      })}
    </div>
  );

  const renderUploadDropzone = () => (
    <AnimatePresence mode="wait">
      {!selectedFile ? (
        <motion.div
          key="dropzone"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/40 hover:bg-accent/40'}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <DocumentArrowUpIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Arrastra tu archivo aquí</p>
          <p className="mt-1 text-xs text-muted-foreground">o haz clic para seleccionar</p>
          <p className="mt-3 text-xs text-muted-foreground">CSV · JSON · Excel | Máx. 10 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.json,.xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="selected"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"
        >
          <CheckCircleIcon className="h-8 w-8 flex-shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {selectedFile.type.split('/').pop()?.toUpperCase() || 'CSV'}
            </p>
            {isLoading && uploadProgress > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Subiendo...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>
          {!isLoading && (
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setUploadProgress(0);
              }}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/projects" className="rounded-lg p-2 transition-colors hover:bg-accent" aria-label="Volver a proyectos">
            <ArrowLeftIcon className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Nuevo Proyecto</h1>
              {showOnboarding && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  <SparklesIcon className="h-3.5 w-3.5" />
                  Guía pro
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {showOnboarding ? 'Sigue 3 pasos guiados para crear tu primer proyecto con mejor calidad.' : 'Define tu proyecto y sube tu dataset en un solo paso'}
            </p>
          </div>
        </div>

        {showOnboarding && (
          <button type="button" onClick={skipOnboarding} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Saltar guía
          </button>
        )}
      </div>

      {showOnboarding && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card/95 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
              <ShieldCheckIcon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-foreground">Onboarding guiado para tu primer proyecto</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Te acompañamos para configurar el contexto, cargar datos y confirmar la creación sin perder tiempo.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {stepLabels.map((step) => {
                  const active = activeStep === step.id;
                  return (
                    <div key={step.id} className={`rounded-2xl border p-4 ${active ? 'border-primary/30 bg-primary/5 shadow-sm' : 'border-border bg-background/50'}`}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paso {step.id}</span>
                        {active && <PlayIcon className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.form
        onSubmit={handleSubmit(onSubmit)}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-5"
      >
        <input type="hidden" {...register('domain')} value={selectedDomain} />

        {showOnboarding ? (
          <div className="space-y-5">
            {activeStep === 1 && (
              <section className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm backdrop-blur-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FolderIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">1. Contexto del proyecto</h2>
                    <p className="text-xs text-muted-foreground">Elige una base rápida o escribe tu propio objetivo</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Plantilla inicial <span className="font-normal text-muted-foreground">(opcional)</span>
                    </label>
                    {renderTemplateCards()}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Nombre del Proyecto <span className="text-rose-500">*</span>
                    </label>
                    <input
                      {...register('name')}
                      type="text"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Ej: Análisis de Ventas Q1 2026"
                      disabled={isLoading}
                    />
                    {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
                    </label>
                    <textarea
                      {...register('description')}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Describe el objetivo del análisis..."
                      disabled={isLoading}
                    />
                    {errors.description && <p className="mt-1 text-xs text-rose-500">{errors.description.message}</p>}
                  </div>
                </div>
              </section>
            )}

            {activeStep === 2 && (
              <section className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm backdrop-blur-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <DocumentArrowUpIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">2. Carga tus datos</h2>
                    <p className="text-xs text-muted-foreground">Puedes subir el archivo ahora o continuar más tarde</p>
                  </div>
                </div>

                {renderUploadDropzone()}

                <div className="mt-4 rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Sugerencia pro</p>
                  <p>Usa un dataset limpio y con columnas claras para que la IA genere análisis y dashboards más útiles desde el primer intento.</p>
                </div>
              </section>
            )}

            {activeStep === 3 && (
              <section className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm backdrop-blur-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                    <CheckCircleIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">3. Revisión final</h2>
                    <p className="text-xs text-muted-foreground">Confirma que todo está listo antes de crear</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Proyecto</p>
                    <p className="font-semibold text-foreground">{getValues('name') || 'Sin nombre todavía'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{getValues('description') || 'Sin descripción'}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Dataset</p>
                    {selectedFile ? (
                      <>
                        <p className="truncate font-semibold text-foreground">{selectedFile.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Todavía no subiste un archivo. Puedes crear el proyecto igual y cargarlo después.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
                  <p className="mb-1 font-semibold">Resultado esperado</p>
                  <p>Al crear el proyecto podrás subir datos, generar dashboards, documentación y análisis con IA desde una base mejor configurada.</p>
                </div>
              </section>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={activeStep === 1 || isLoading}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Atrás
              </button>

              <div className="flex items-center gap-3">
                {activeStep < 3 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continuar
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                        {uploadProgress > 0 ? `Subiendo ${uploadProgress}%...` : 'Creando...'}
                      </>
                    ) : (
                      <>
                        Crear proyecto
                        <ArrowRightIcon className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm backdrop-blur-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FolderIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Información del proyecto</h2>
                  <p className="text-xs text-muted-foreground">Nombre, descripción y contexto de tu análisis</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Plantilla inicial <span className="font-normal text-muted-foreground">(opcional)</span></label>
                  {renderTemplateCards()}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Nombre del Proyecto <span className="text-rose-500">*</span></label>
                  <input
                    {...register('name')}
                    type="text"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Ej: Análisis de Ventas Q1 2026"
                    disabled={isLoading}
                  />
                  {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Descripción <span className="font-normal text-muted-foreground">(opcional)</span></label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Describe el objetivo del análisis..."
                    disabled={isLoading}
                  />
                  {errors.description && <p className="mt-1 text-xs text-rose-500">{errors.description.message}</p>}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card/95 p-6 shadow-sm backdrop-blur-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <DocumentArrowUpIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Dataset</h2>
                  <p className="text-xs text-muted-foreground">Sube tu archivo de datos o crea el proyecto primero</p>
                </div>
              </div>
              {renderUploadDropzone()}
            </section>

            <div className="flex items-center justify-between">
              <Link href="/dashboard/projects" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                    {uploadProgress > 0 ? `Subiendo ${uploadProgress}%...` : 'Creando...'}
                  </>
                ) : (
                  <>
                    {selectedFile ? 'Crear proyecto y subir dataset' : 'Crear proyecto'}
                    <ArrowRightIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.form>
    </div>
  );
}
