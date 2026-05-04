'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  DocumentIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { projectsApi, uploadApi } from '@/lib/api';
import { Project, Dataset } from '@/types';

const editProjectSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es muy largo'),
  description: z.string().max(500, 'La descripción es muy larga'),
});

type EditProjectData = z.infer<typeof editProjectSchema>;

interface UploadProgress {
  [key: string]: number;
}

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = params.id as string;

  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

  // Get project data
  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  });

  const project: Project | undefined = projectData?.data?.data;

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
  } = useForm<EditProjectData>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      name: project?.name || '',
      description: project?.description || '',
    },
  });

  // Update form values when project data loads
  useEffect(() => {
    if (project) {
      setValue('name', project.name);
      setValue('description', project.description);
    }
  }, [project, setValue]);

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: (data: EditProjectData) => projectsApi.updateProject(projectId, data),
    onSuccess: () => {
      toast.success('Proyecto actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: () => {
      toast.error('Error al actualizar el proyecto');
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: ({ file, fileName }: { file: File; fileName: string }) =>
      uploadApi.uploadFile(projectId, file, (progress) => {
        setUploadProgress(prev => ({ ...prev, [fileName]: progress }));
      }),
    onSuccess: (_, { fileName }) => {
      toast.success(`Archivo ${fileName} subido exitosamente`);
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });
      setUploadProgress(prev => {
        const newPrev = { ...prev };
        delete newPrev[fileName];
        return newPrev;
      });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (_, { fileName }) => {
      toast.error(`Error al subir ${fileName}`);
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });
      setUploadProgress(prev => {
        const newPrev = { ...prev };
        delete newPrev[fileName];
        return newPrev;
      });
    },
  });

  // Delete dataset mutation
  const deleteDatasetMutation = useMutation({
    mutationFn: (datasetId: string) => uploadApi.deleteDataset(projectId, datasetId),
    onSuccess: () => {
      toast.success('Dataset eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: () => {
      toast.error('Error al eliminar el dataset');
    },
  });

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const fileName = file.name;
      setUploadingFiles(prev => new Set(Array.from(prev).concat([fileName])));
      setUploadProgress(prev => ({ ...prev, [fileName]: 0 }));
      
      uploadFileMutation.mutate({ file, fileName });
    });
  }, [uploadFileMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const onSubmit = (data: EditProjectData) => {
    updateProjectMutation.mutate(data);
  };

  const handleDeleteDataset = (datasetId: string, datasetName: string) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el dataset "${datasetName}"? Esta acción no se puede deshacer.`)) {
      deleteDatasetMutation.mutate(datasetId);
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

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Proyecto no encontrado</h1>
          <p className="text-gray-600 mb-4">El proyecto que buscas no existe o no tienes permisos para editarlo.</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => router.push(`/dashboard/projects/${projectId}`)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Volver
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Editar Proyecto</h1>
              <p className="text-gray-600 mt-1">Modificar información y gestionar datasets</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Project Info Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white shadow rounded-lg"
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Información del Proyecto</h3>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Nombre del proyecto *
                  </label>
                  <input
                    type="text"
                    id="name"
                    {...register('name')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Ejemplo: Análisis de Ventas Q1"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    {...register('description')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Describe el propósito y objetivos del proyecto..."
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/projects/${projectId}`)}
                  className="inline-flex justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isDirty || updateProjectMutation.isPending}
                  className="inline-flex justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {updateProjectMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </motion.div>

          {/* Upload Datasets */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white shadow rounded-lg"
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Gestionar Datasets</h3>
              <p className="text-sm text-gray-500 mt-1">
                Sube archivos CSV o Excel para analizar. Máximo 50MB por archivo.
              </p>
            </div>

            <div className="p-6">
              {/* Upload Area */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <p className="text-sm text-gray-600">
                    {isDragActive
                      ? 'Suelta los archivos aquí...'
                      : 'Arrastra archivos aquí, o haz clic para seleccionar'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    CSV, XLS, XLSX hasta 50MB
                  </p>
                </div>
              </div>

              {/* Upload Progress */}
              {Object.keys(uploadProgress).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Subiendo archivos:</h4>
                  <div className="space-y-2">
                    {Object.entries(uploadProgress).map(([fileName, progress]) => (
                      <div key={fileName} className="flex items-center space-x-3">
                        <DocumentIcon className="h-5 w-5 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">{progress}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Current Datasets */}
              {project.datasets && project.datasets.length > 0 && (
                <div className="mt-8">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Datasets actuales ({project.datasets.length}):
                  </h4>
                  <div className="space-y-3">
                    {project.datasets.map((dataset: Dataset) => (
                      <div
                        key={dataset._id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <DocumentIcon className="h-8 w-8 text-blue-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {dataset.originalName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(dataset.size)} • {dataset.metadata?.rowCount || 0} registros • {new Date(dataset.uploadedAt).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckIcon className="h-3 w-3 mr-1" />
                            Procesado
                          </span>
                          <button
                            onClick={() => handleDeleteDataset(dataset._id, dataset.originalName)}
                            disabled={deleteDatasetMutation.isPending}
                            className="inline-flex items-center p-1.5 border border-transparent rounded text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {(!project.datasets || project.datasets.length === 0) && Object.keys(uploadProgress).length === 0 && (
                <div className="text-center py-8">
                  <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Sin datasets</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Este proyecto no tiene datasets. Sube archivos para empezar el análisis.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}