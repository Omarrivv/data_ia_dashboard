'use client';

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
  BellIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  CogIcon,
  ChevronDownIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import Link from 'next/link';
import clsx from 'clsx';

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const initials = (user?.name || 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="bg-white/80 dark:bg-slate-950/70 backdrop-blur-xl border-b border-border shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center" />

          <div className="flex items-center gap-2">
            {user?.role === 'admin' && (
              <span className="hidden sm:inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20">
                Admin
              </span>
            )}

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
            </button>

            {/* Notifications bell */}
            <div className="relative">
              <button
                type="button"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <BellIcon className="h-5 w-5" />
              </button>
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950" />
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-border mx-1" />

            {/* Profile dropdown */}
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-accent dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary group">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-violet-600 flex items-center justify-center shadow-sm flex-shrink-0 ring-1 ring-white/20">
                  <span className="text-xs font-bold text-white">{initials}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-foreground dark:text-slate-100 leading-tight max-w-[120px] truncate">
                    {user?.name}
                  </p>
                </div>
                <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors hidden sm:block" />
              </Menu.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl ring-1 ring-border dark:ring-slate-700 focus:outline-none z-50 overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 border-b border-border dark:border-slate-700 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-white/20">
                      <span className="text-sm font-bold text-white">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground dark:text-slate-100 truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground dark:text-slate-400 truncate">{user?.email}</p>
                    </div>
                  </div>

                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/dashboard/profile"
                          className={clsx(
                            active ? 'bg-accent dark:bg-slate-800' : '',
                            'flex items-center gap-3 px-4 py-2.5 text-sm text-foreground dark:text-slate-300 transition-colors'
                          )}
                        >
                          <UserCircleIcon className="h-4 w-4 text-muted-foreground dark:text-slate-500" />
                          Mi Perfil
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/dashboard/settings"
                          className={clsx(
                            active ? 'bg-accent dark:bg-slate-800' : '',
                            'flex items-center gap-3 px-4 py-2.5 text-sm text-foreground dark:text-slate-300 transition-colors'
                          )}
                        >
                          <CogIcon className="h-4 w-4 text-muted-foreground dark:text-slate-500" />
                          Configuración
                        </Link>
                      )}
                    </Menu.Item>

                    {user?.role === 'admin' && (
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            href="/dashboard/admin/audit"
                            className={clsx(
                              active ? 'bg-accent dark:bg-slate-800' : '',
                              'flex items-center gap-3 px-4 py-2.5 text-sm text-foreground dark:text-slate-300 transition-colors'
                            )}
                          >
                              <UserCircleIcon className="h-4 w-4 text-muted-foreground dark:text-slate-500" />
                            Auditoría
                          </Link>
                        )}
                      </Menu.Item>
                    )}
                  </div>

                  <div className="border-t border-border dark:border-slate-700 py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={logout}
                          className={clsx(
                            active ? 'bg-red-50 dark:bg-red-900/20' : '',
                            'flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 transition-colors'
                          )}
                        >
                          <ArrowRightOnRectangleIcon className="h-4 w-4" />
                          Cerrar sesión
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>
    </div>
  );
}

