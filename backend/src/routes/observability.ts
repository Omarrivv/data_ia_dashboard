import express from 'express';
import { getMetrics } from '../services/metricsService';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// Protect metrics: only authenticated admins can read operational metrics
router.get('/metrics', authenticate, requireRole(['admin']), asyncHandler(async (req, res) => {
  try {
    const m = getMetrics();
    res.json(m);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo métricas' });
  }
}));

export default router;
