'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BellIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  function saveSection(label: string) {
    toast.success(`${label} guardado`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Personaliza las preferencias de tu cuenta</p>
      </div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <BellIcon className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Notificaciones</h2>
        </div>

        <div className="space-y-4">
          {[
            { key: 'projectReady', label: 'Proyecto listo para usar', desc: 'Cuando el procesamiento inicial termina' },
            { key: 'analysisComplete', label: 'Análisis de IA completado', desc: 'Al finalizar el análisis con Gemini' },
            { key: 'weeklyReport', label: 'Reporte semanal', desc: 'Resumen de actividad cada lunes' },
            { key: 'errorAlerts', label: 'Alertas de error', desc: 'Si un proceso falla o hay errores' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <Toggle
                checked={notifs[item.key as keyof typeof notifs]}
                onChange={(v) => setNotifs((n) => ({ ...n, [item.key]: v }))}
              />
            </div>
          ))}
        </div>

        <button
          onClick={() => saveSection('Notificaciones')}
          className="mt-5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Guardar preferencias
        </button>
      </motion.div>

      {/* Privacy */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Privacidad</h2>
        </div>

        <div className="space-y-4">
          {[
            { key: 'shareAnalytics', label: 'Compartir datos de uso anónimos', desc: 'Ayuda a mejorar la plataforma' },
            { key: 'publicProfile', label: 'Perfil público', desc: 'Otros usuarios pueden ver tu perfil' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <Toggle
                checked={privacy[item.key as keyof typeof privacy]}
                onChange={(v) => setPrivacy((p) => ({ ...p, [item.key]: v }))}
              />
            </div>
          ))}
        </div>

        <button
          onClick={() => saveSection('Privacidad')}
          className="mt-5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Guardar preferencias
        </button>
      </motion.div>

      {/* Language */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <GlobeAltIcon className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Idioma y región</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Idioma de la interfaz</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full max-w-xs px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Zona horaria</label>
            <select
              defaultValue="America/Lima"
              className="w-full max-w-xs px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="America/Lima">América/Lima (GMT-5)</option>
              <option value="America/Bogota">América/Bogotá (GMT-5)</option>
              <option value="America/Mexico_City">América/Ciudad de México (GMT-6)</option>
              <option value="America/Argentina/Buenos_Aires">América/Buenos Aires (GMT-3)</option>
              <option value="Europe/Madrid">Europa/Madrid (GMT+1)</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => saveSection('Idioma y región')}
          className="mt-5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Guardar
        </button>
      </motion.div>

      {/* Danger zone */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl border border-red-200 shadow-sm p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
          <h2 className="text-base font-semibold text-gray-900">Zona de peligro</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border border-red-100 rounded-lg px-4 bg-red-50/50">
            <div>
              <p className="text-sm font-medium text-gray-800">Eliminar cuenta</p>
              <p className="text-xs text-gray-500">Esta acción es permanente e irreversible</p>
            </div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>

          {confirmDelete && (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50 space-y-3">
              <p className="text-sm text-red-700 font-medium">
                ¿Estás seguro? Se eliminarán todos tus proyectos, datasets y análisis.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => toast.error('Función no disponible en esta versión')}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Sí, eliminar mi cuenta
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
