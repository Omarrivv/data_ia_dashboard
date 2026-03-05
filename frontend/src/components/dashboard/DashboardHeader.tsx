'use client';

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
  BellIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  CogIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import clsx from 'clsx';

export function DashboardHeader() {
  const { user, logout } = useAuth();

  const initials = (user?.name || 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center" />

          <div className="flex items-center gap-2">
            {/* Notifications bell */}
            <div className="relative">
              <button
                type="button"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <BellIcon className="h-5 w-5" />
              </button>
              {/* Static notification dot */}
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-gray-200 mx-1" />

            {/* Profile dropdown */}
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 group">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm flex-shrink-0">
                  <span className="text-xs font-bold text-white">{initials}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-gray-800 leading-tight max-w-[120px] truncate">
                    {user?.name}
                  </p>
                </div>
                <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 transition-colors hidden sm:block" />
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
                <Menu.Items className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg bg-white ring-1 ring-gray-200 focus:outline-none z-50 overflow-hidden">
                  {/* User info header */}
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-gray-100 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="text-sm font-bold text-white">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                  </div>

                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/dashboard/profile"
                          className={clsx(
                            active ? 'bg-gray-50' : '',
                            'flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors'
                          )}
                        >
                          <UserCircleIcon className="h-4 w-4 text-gray-400" />
                          Mi Perfil
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/dashboard/settings"
                          className={clsx(
                            active ? 'bg-gray-50' : '',
                            'flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors'
                          )}
                        >
                          <CogIcon className="h-4 w-4 text-gray-400" />
                          Configuración
                        </Link>
                      )}
                    </Menu.Item>
                  </div>

                  <div className="border-t border-gray-100 py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={logout}
                          className={clsx(
                            active ? 'bg-red-50' : '',
                            'flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm text-red-600 transition-colors'
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