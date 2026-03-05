/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deshabilitar optimización de fuentes — evita peticiones a Google Fonts al arrancar
  optimizeFonts: false,
  // Configuración existente
  images: {
    domains: ['localhost'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  },
  
  // Optimizaciones para evitar warnings de hidratación
  experimental: {
    optimizePackageImports: ['@tanstack/react-query'],
  },
  
  // Configuración para mejor desarrollo
  reactStrictMode: true,
  
  // Configuración para evitar errores de atributos externos
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
  
  // Configuración de webpack para ignorar warnings específicos
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Ignorar warnings específicos de hydration en desarrollo
      config.infrastructureLogging = {
        level: 'error'
      };
    }
    return config;
  },
  
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/:path*`,
      },
    ];
  },
  
  // Headers para mejorar la experiencia del desarrollador
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig;