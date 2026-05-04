import express from 'express';
import { getMetrics } from '../services/metricsService';

const router = express.Router();

router.get('/metrics', async (req, res) => {
  try {
    const m = getMetrics();
    res.json(m);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo métricas' });
  }
});

export default router;
