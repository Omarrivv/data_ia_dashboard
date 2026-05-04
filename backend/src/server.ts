import dotenv from 'dotenv';

// Cargar variables de entorno PRIMERO
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import cookieParser from 'cookie-parser';

import { connectDB } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import projectRoutes from './routes/projects';
import jobsRoutes from './routes/jobs';
import dashboardRoutes from './routes/dashboards';
import uploadRoutes from './routes/upload';
import observabilityRoutes from './routes/observability';
import requestIdMiddleware from './middleware/requestId';
import { expressLoggerMiddleware, logger } from './middleware/logger';
import { recordRequest } from './services/metricsService';
import { authLimiter, readLimiter, analysisLimiter, uploadLimiter, adminLimiter, globalLimiter } from './middleware/rateLimiters';

// Cargar variables de entorno
// dotenv.config(); // Ya se cargó al inicio

const app = express();
// Configure trusted proxies for correct client IP resolution behind proxies/load balancers
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
}
const PORT = process.env.PORT || 5000;

// Conectar a MongoDB
connectDB();

// Middleware de seguridad
app.use(helmet());
app.use(compression());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Parse cookies securely using cookie-parser middleware
app.use(cookieParser());

// Rate limiting (granular por tipo de endpoint)
// Global fallback
app.use('/api/', globalLimiter);

// Auth: muy estricto
app.use('/api/auth', authLimiter);

// Admin: muy estricto
app.use('/api/admin', adminLimiter);

// Analysis endpoints: moderados
app.use('/api/projects/:id/analyze', analysisLimiter);

// Upload: moderados
app.use('/api/upload', uploadLimiter);

// Read endpoints: flexibles (GET requests)
app.get('/api/dashboards', readLimiter);
app.get('/api/projects', readLimiter);
app.get('/api/jobs', readLimiter);


// Request id & structured logger middleware
app.use(requestIdMiddleware);
app.use(expressLoggerMiddleware);

// Logging (morgan kept for compatibility)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Metrics: measure response time and record
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode || 0;
    try {
      recordRequest(req.originalUrl, req.method, status, duration);
    } catch (e) {
      logger.warn('Error recording metrics', { err: e instanceof Error ? e.message : String(e) });
    }
    try {
      (req as any).log?.info('request_end', { status, duration });
    } catch (e) {
      // ignore
    }
  });
  next();
});

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/observability', observabilityRoutes);

// Ruta de bienvenida
app.get('/api', (req, res) => {
  res.json({
    message: '🚀 Dashboard Platform API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      projects: '/api/projects',
      dashboards: '/api/dashboards',
      upload: '/api/upload'
    }
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    path: req.originalUrl
  });
});

// Middleware de manejo de errores
app.use(errorHandler);

// Iniciar servidor
app.listen(PORT, () => {
  logger.info('server_start', { port: PORT, env: process.env.NODE_ENV });
  logger.info('health_check', { url: `http://localhost:${PORT}/health` });
});

// Start background job worker
import { startWorker } from './services/jobQueueService';
startWorker();

// Manejo de errores no capturados
process.on('unhandledRejection', (err: Error) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

process.on('uncaughtException', (err: Error) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

export default app;