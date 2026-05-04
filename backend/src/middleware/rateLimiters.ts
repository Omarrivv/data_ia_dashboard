import rateLimit from 'express-rate-limit';

/**
 * Auth endpoints: estricto (intenta prevenir ataques de fuerza bruta)
 */
export const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000'), // 15 min default
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5'), // 5 intentos por ventana
  message: {
    error: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000') / 1000)
  },
  standardHeaders: true, // Retorna info en `RateLimit-*` headers
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development', // Desactivar en dev
});

/**
 * Lectura (GET): flexible
 */
export const readLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_READ_WINDOW_MS || '900000'), // 15 min
  max: parseInt(process.env.RATE_LIMIT_READ_MAX || '100'), // 100 requests por ventana
  message: {
    error: 'Límite de lectura excedido. Intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => {
    // Agrupar por IP (por defecto) pero respetar X-Forwarded-For si está detrás de proxy
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  }
});

/**
 * Análisis/Generación: moderado (recursos costosos)
 */
export const analysisLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_ANALYSIS_WINDOW_MS || '3600000'), // 1 hora
  max: parseInt(process.env.RATE_LIMIT_ANALYSIS_MAX || '10'), // 10 análisis por hora
  message: {
    error: 'Has alcanzado el límite de análisis por hora. Intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
});

/**
 * Upload: moderado (consume ancho de banda y almacenamiento)
 */
export const uploadLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || '3600000'), // 1 hora
  max: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || '20'), // 20 uploads por hora
  message: {
    error: 'Has alcanzado el límite de descargas por hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
});

/**
 * Admin: muy estricto (operaciones sensibles)
 */
export const adminLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_ADMIN_WINDOW_MS || '600000'), // 10 min
  max: parseInt(process.env.RATE_LIMIT_ADMIN_MAX || '20'), // 20 requests por 10 min
  message: {
    error: 'Límite de operaciones administrativas excedido. Intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
});

/**
 * Global default (fallback si nada más aplica)
 */
export const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests
  message: {
    error: 'Demasiadas solicitudes desde esta IP. Intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
});
