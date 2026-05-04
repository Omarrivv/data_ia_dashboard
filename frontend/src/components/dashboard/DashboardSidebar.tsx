'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  HomeIcon,
  FolderIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CogIcon,
  XMarkIcon,
  Bars3Icon,
  UserCircleIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import clsx from 'clsx';

export function DashboardSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Proyectos', href: '/dashboard/projects', icon: FolderIcon },
    { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon },
    { name: 'Documentación', href: '/dashboard/docs', icon: DocumentTextIcon },
    { name: 'Configuración', href: '/dashboard/settings', icon: CogIcon },
    ...(user?.role === 'admin'
      ? [{ name: 'Auditoría', href: '/dashboard/admin/audit', icon: UserCircleIcon }]
      : []),
  ];

  return (
    <>
      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <div className="fixed inset-0 flex z-40">
          {sidebarOpen && (
            <>
              <div
                className="fixed inset-0 bg-slate-950/70 backdrop-blur-[2px]"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'tween', duration: 0.3 }}
                className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-950 text-slate-100"
              >
                <div className="absolute top-0 right-0 -mr-12 pt-2">
                  <button
                    type="button"
                    className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <XMarkIcon className="h-6 w-6 text-white" />
                  </button>
                </div>
                <SidebarContent />
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/30">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          type="button"
          className="bg-white/90 dark:bg-slate-900/90 backdrop-blur p-2 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
          onClick={() => setSidebarOpen(true)}
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
      </div>
    </>
  );

  function SidebarContent() {
    return (
      <>
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-5 py-5 border-b border-white/10">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/30 ring-1 ring-white/10">
              <ChartBarIcon className="w-5 h-5 text-white" />
            </div>
            <span className="ml-2.5 text-base font-bold text-white tracking-tight">DataPlatform</span>
          </div>
          <nav className="mt-4 flex-1 px-3 space-y-0.5">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/')) || (item.href === '/dashboard' && pathname === '/dashboard');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150',
                    isActive
                      ? 'bg-gradient-to-r from-primary to-violet-500 text-white shadow-sm shadow-violet-950/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                  )}
                >
                  <item.icon
                    className={clsx(
                      'mr-3 flex-shrink-0 h-5 w-5 transition-colors',
                      isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                    )}
                  />
                  {item.name}
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <Link
          href="/dashboard/profile"
          className="flex-shrink-0 flex items-center gap-3 border-t border-white/10 p-4 hover:bg-white/5 transition-colors rounded-b-none group"
        >
          <div className="flex-shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
              <span className="text-sm font-bold text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <ChevronRightIcon className="h-4 w-4 text-slate-600 group-hover:text-slate-300 flex-shrink-0 transition-colors" />
        </Link>
      </>
    );
  }
}