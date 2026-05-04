import { Request } from 'express';
import { ProjectDocument } from '../models/Project';
import { createError } from './errorHandler';
import { ProjectSharePermission } from '../types';

export type ProjectAccessMode = 'owner' | 'viewer' | 'editor';

export interface ProjectAccessResult {
  project: ProjectDocument;
  accessMode: ProjectAccessMode;
  shareToken?: string;
}

const extractShareToken = (req: Request): string | undefined => {
  const fromQuery = typeof req.query.shareToken === 'string' ? req.query.shareToken : undefined;
  const fromHeader = typeof req.header('x-share-token') === 'string' ? req.header('x-share-token') || undefined : undefined;
  return fromQuery || fromHeader;
};

export function getProjectSharingLink(projectId: string, token: string): string {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/dashboard/projects/${projectId}?share=${encodeURIComponent(token)}`;
}

export function ensureOwner(project: ProjectDocument, userId: string) {
  if (project.userId?.toString() !== userId) {
    throw createError('Permisos insuficientes', 403);
  }
}

export function getEffectiveAccessMode(project: ProjectDocument, required: ProjectSharePermission, shareToken?: string): ProjectAccessMode {
  if (!project.sharing?.enabled || !project.sharing.token) {
    throw createError('Proyecto no encontrado', 404);
  }

  if (!shareToken || shareToken !== project.sharing.token) {
    throw createError('Proyecto no encontrado', 404);
  }

  if (required === 'editor' && project.sharing.permission !== 'editor') {
    throw createError('Permisos insuficientes', 403);
  }

  return project.sharing.permission;
}

export function getShareTokenFromRequest(req: Request): string | undefined {
  return extractShareToken(req);
}

export function getProjectAccess(project: ProjectDocument, userId: string, required: ProjectSharePermission, shareToken?: string): ProjectAccessResult {
  if (project.userId?.toString() === userId) {
    return { project, accessMode: 'owner' };
  }

  const token = shareToken || undefined;
  const accessMode = getEffectiveAccessMode(project, required, token);
  return { project, accessMode, shareToken: token };
}
