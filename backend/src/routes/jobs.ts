import express from 'express';
import { authenticate } from '../middleware/auth';
import { AnalysisJob } from '../models/AnalysisJob';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = express.Router();

router.use(authenticate);

/**
 * @route GET /api/jobs/:id
 * @desc  Obtener estado de un job (solo owner)
 */
router.get('/:id', asyncHandler(async (req: express.Request, res: express.Response) => {
  if (!req.user) throw createError('Usuario no autenticado', 401);
  const job = await AnalysisJob.findById(req.params.id).lean();
  if (!job) throw createError('Job no encontrado', 404);
  if (job.userId.toString() !== req.user._id.toString()) throw createError('No autorizado', 403);

  res.json({ success: true, data: job });
}));

export default router;
