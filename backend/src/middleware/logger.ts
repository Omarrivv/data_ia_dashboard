import { Request, Response, NextFunction } from 'express';

export type LogMeta = Record<string, any> | undefined;

function formatEntry(level: string, message: string, meta?: LogMeta) {
  const base = {
    ts: new Date().toISOString(),
    level,
    message,
  } as any;
  if (meta && typeof meta === 'object') Object.assign(base, meta);
  return JSON.stringify(base);
}

export const logger = {
  info: (message: string, meta?: LogMeta) => console.log(formatEntry('info', message, meta)),
  warn: (message: string, meta?: LogMeta) => console.warn(formatEntry('warn', message, meta)),
  error: (message: string, meta?: LogMeta) => console.error(formatEntry('error', message, meta)),
  debug: (message: string, meta?: LogMeta) => console.debug(formatEntry('debug', message, meta)),
};

export function expressLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const reqId = (req as any).requestId || null;
  const baseMeta = {
    requestId: reqId,
    method: req.method,
    path: req.path,
  } as any;

  // Attach contextual log to request
  (req as any).log = {
    info: (msg: string, m?: LogMeta) => logger.info(msg, { ...baseMeta, ...m }),
    warn: (msg: string, m?: LogMeta) => logger.warn(msg, { ...baseMeta, ...m }),
    error: (msg: string, m?: LogMeta) => logger.error(msg, { ...baseMeta, ...m }),
    debug: (msg: string, m?: LogMeta) => logger.debug(msg, { ...baseMeta, ...m }),
  };

  // Log basic request start
  (req as any).log.info('request_start');
  next();
}

export default logger;
