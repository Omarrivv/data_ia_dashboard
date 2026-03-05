'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserCircleIcon,
  EnvelopeIcon,
  LockClosedIcon,
  PencilIcon,
  CheckIcon,
  FolderIcon,
  ChartBarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { authApi, projectsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  email: z.string().email('Email inválido'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword: z.string().min(6, 'Mínimo 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu nueva contraseña'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: authApi.getProfile,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects({ limit: 100 }),
  });

  const profile = profileData?.data?.data || user;
  const projects = projectsData?.data?.data?.projects || [];
  const totalDatasets = projects.reduce((acc: number, p: any) => acc + (p.datasets?.length || 0), 0);
  const analyzedProjects = projects.filter((p: any) => p.dashboard).length;

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile?.name || '', email: profile?.email || '' },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileFormData) => authApi.updateProfile(data),
    onSuccess: () => {
      toast.success('Perfil actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditingProfile(false);
    },
    onError: () => toast.error('Error al actualizar el perfil'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordFormData) =>
      authApi.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente');
      passwordForm.reset();
      setEditingPassword(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Error al cambiar la contraseña';
      toast.error(msg);
    },
  });

  const initials = (profile?.name || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })
    : '—';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-500 text-sm mt-1">Gestiona tu información personal y seguridad de la cuenta</p>
      </div>

      {/* Avatar + stats */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
          </div>

          {/* Name & meta */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">{profile?.name}</h2>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
              <EnvelopeIcon className="h-3.5 w-3.5" />
              {profile?.email}
            </p>
            <p className="text-xs text-gray-400 mt-1">Miembro desde {memberSince}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-gray-100">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-9 h-9 bg-blue-50 rounded-lg mb-2">
              <FolderIcon className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
            <p className="text-xs text-gray-500">Proyectos</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-9 h-9 bg-emerald-50 rounded-lg mb-2">
              <DocumentTextIcon className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalDatasets}</p>
            <p className="text-xs text-gray-500">Datasets</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-9 h-9 bg-violet-50 rounded-lg mb-2">
              <ChartBarIcon className="h-5 w-5 text-violet-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{analyzedProjects}</p>
            <p className="text-xs text-gray-500">Analizados</p>
          </div>
        </div>
      </motion.div>

      {/* Edit profile */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <UserCircleIcon className="h-5 w-5 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900">Información Personal</h3>
          </div>
          {!editingProfile && (
            <button
              onClick={() => {
                profileForm.setValue('name', profile?.name || '');
                profileForm.setValue('email', profile?.email || '');
                setEditingProfile(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Editar
            </button>
          )}
        </div>

        {editingProfile ? (
          <form
            onSubmit={profileForm.handleSubmit((d) => updateProfileMutation.mutate(d))}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
              <input
                {...profileForm.register('name')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {profileForm.formState.errors.name && (
                <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
              <input
                {...profileForm.register('email')}
                type="email"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {profileForm.formState.errors.email && (
                <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <CheckIcon className="h-4 w-4" />
                {updateProfileMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 py-2.5 border-b border-gray-50">
              <span className="text-sm text-gray-500 w-36">Nombre</span>
              <span className="text-sm font-medium text-gray-900">{profile?.name}</span>
            </div>
            <div className="flex items-center gap-3 py-2.5">
              <span className="text-sm text-gray-500 w-36">Correo electrónico</span>
              <span className="text-sm font-medium text-gray-900">{profile?.email}</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Change password */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <LockClosedIcon className="h-5 w-5 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900">Seguridad</h3>
          </div>
          {!editingPassword && (
            <button
              onClick={() => setEditingPassword(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <LockClosedIcon className="h-3.5 w-3.5" />
              Cambiar contraseña
            </button>
          )}
        </div>

        {editingPassword ? (
          <form
            onSubmit={passwordForm.handleSubmit((d) => changePasswordMutation.mutate(d))}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña actual</label>
              <input
                {...passwordForm.register('currentPassword')}
                type="password"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
              <input
                {...passwordForm.register('newPassword')}
                type="password"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Mínimo 6 caracteres"
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar nueva contraseña</label>
              <input
                {...passwordForm.register('confirmPassword')}
                type="password"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Repite la nueva contraseña"
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <CheckIcon className="h-4 w-4" />
                {changePasswordMutation.isPending ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
              <button
                type="button"
                onClick={() => { setEditingPassword(false); passwordForm.reset(); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3 py-2.5">
            <span className="text-sm text-gray-500 w-36">Contraseña</span>
            <span className="text-sm text-gray-400">••••••••</span>
          </div>
        )}
      </motion.div>

      {/* Danger zone */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-red-100 p-6"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-1">Cerrar sesión</h3>
        <p className="text-sm text-gray-500 mb-4">Salir de tu cuenta en este dispositivo.</p>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
        >
          Cerrar sesión
        </button>
      </motion.div>
    </div>
  );
}
