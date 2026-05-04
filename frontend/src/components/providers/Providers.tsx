'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useTheme } from '@/contexts/ThemeContext';

function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: theme === 'dark' ? '#0f172a' : '#ffffff',
          color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
          border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #e2e8f0',
          boxShadow: theme === 'dark' ? '0 20px 50px rgba(15, 23, 42, 0.45)' : '0 20px 50px rgba(15, 23, 42, 0.12)',
        },
        success: {
          duration: 3000,
          style: {
            background: theme === 'dark' ? '#052e16' : '#ecfdf5',
            color: theme === 'dark' ? '#bbf7d0' : '#065f46',
            border: '1px solid rgba(16, 185, 129, 0.25)',
          },
        },
        error: {
          duration: 4000,
          style: {
            background: theme === 'dark' ? '#450a0a' : '#fef2f2',
            color: theme === 'dark' ? '#fecaca' : '#991b1b',
            border: '1px solid rgba(239, 68, 68, 0.25)',
          },
        },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: (failureCount, error: any) => {
              const status = error?.response?.status;

              // No retry on client errors or auth errors
              if (status && status >= 400 && status < 500) {
                return false;
              }
              return failureCount < 3;
            },
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          {children}
          <AppToaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}