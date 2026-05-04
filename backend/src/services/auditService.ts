import { Request } from 'express';
import { AuditLog } from '../models/AuditLog';

export interface AuditEventInput {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  success?: boolean;
  metadata?: Record<string, any>;
  req?: Request;
}

export const recordAuditEvent = (input: AuditEventInput): void => {
  void AuditLog.create({
    userId: input.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    success: input.success ?? true,
    metadata: input.metadata ?? {},
    ipAddress: input.req?.ip,
    userAgent: input.req?.get('User-Agent'),
  }).catch((error) => {
    console.error('❌ Error registrando auditoría:', error);
  });
};