import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers/Providers';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CleanAttributesProvider } from '@/hooks/useCleanExternalAttributes';

export const metadata: Metadata = {
  title: 'Dashboard Platform - Dashboards Dinámicos con IA',
  description: 'Plataforma para crear dashboards dinámicos e inteligentes usando IA Gemini.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <CleanAttributesProvider>
          <ErrorBoundary>
            <Providers>
              {children}
            </Providers>
          </ErrorBoundary>
        </CleanAttributesProvider>
      </body>
    </html>
  );
}