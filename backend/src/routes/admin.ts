import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AuditLog } from '../models/AuditLog';
import { ApiResponse, UserRole } from '../types';

const router = express.Router();

router.use(authenticate, requireRole([UserRole.ADMIN]));

router.get('/audit-logs', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const action = req.query.action as string | undefined;
  const resourceType = req.query.resourceType as string | undefined;

  const filters: Record<string, any> = {};
  if (action) filters.action = action;
  if (resourceType) filters.resourceType = resourceType;

  const skip = (page - 1) * limit;
  const [entries, total] = await Promise.all([
    AuditLog.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filters),
  ]);

  res.json({
    success: true,
    data: {
      entries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
}));

router.get('/summary', asyncHandler(async (req: express.Request, res: express.Response<ApiResponse>) => {
  const [totalLogs, recentLogs, actions] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
    AuditLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      totalLogs,
      recentLogs,
      actions,
    },
  });
}));

export default router;