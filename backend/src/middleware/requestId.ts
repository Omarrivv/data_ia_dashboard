import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prefer existing incoming header
  const incoming = (req.headers['x-request-id'] as string) || (req.headers['x-correlation-id'] as string);
  const id = incoming || (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
  // Attach to req and response header
  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

export default requestIdMiddleware;
