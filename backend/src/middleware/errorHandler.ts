import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log del error
  console.error('❌ Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message).join(', ');
    error = createError(message, 400);
  }

  // Error de duplicado de Mongoose
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    const message = `${field} ya existe`;
    error = createError(message, 400);
  }

  // Error de cast de Mongoose (ID inválido)
  if (err.name === 'CastError') {
    const message = 'ID de recurso inválido';
    error = createError(message, 400);
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token inválido';
    error = createError(message, 401);
  }

  // Error de JWT expirado
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expirado';
    error = createError(message, 401);
  }

  // Error de archivo muy grande
  if (err.message === 'File too large') {
    const message = 'Archivo demasiado grande';
    error = createError(message, 413);
  }

  // Error de tipo de archivo no permitido
  if (err.message?.includes('Only') && err.message?.includes('files are allowed')) {
    const message = 'Tipo de archivo no permitido';
    error = createError(message, 400);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Error interno del servidor';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      error: err.message,
      stack: err.stack
    })
  });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const notFound = (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
  const error = createError(`Ruta no encontrada - ${req.originalUrl}`, 404);
  next(error);
};