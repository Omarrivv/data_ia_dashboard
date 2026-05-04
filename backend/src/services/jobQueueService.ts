import { AnalysisJob } from '../models/AnalysisJob';
import { runProjectAnalysis } from './projectAnalysisService';
import { Project } from '../models/Project';
import { recordAuditEvent } from './auditService';

let activeWorkers = 0;
const MAX_CONCURRENCY = parseInt(process.env.ANALYSIS_CONCURRENCY || '2');

export async function enqueueAnalysis(projectId: string, userId: string) {
  // Prevent duplicate queued/processing jobs for the same project
  const existing = await AnalysisJob.findOne({ projectId, status: { $in: ['queued', 'processing'] } });
  if (existing) {
    return existing;
  }

  const job = await AnalysisJob.create({ projectId, userId, status: 'queued', progress: 0 });
  return job;
}

export async function getJobById(jobId: string) {
  return AnalysisJob.findById(jobId).lean();
}

async function claimNextJob() {
  // Find oldest queued job and mark processing atomically
  const job = await AnalysisJob.findOneAndUpdate(
    { status: 'queued' },
    { status: 'processing', progress: 0 },
    { sort: { createdAt: 1 }, new: true }
  );
  return job;
}

async function updateJobProgress(jobId: string, progress: number, message?: string) {
  const update: any = { progress };
  if (message) {
    update.$push = { logs: { ts: new Date(), message } };
    update.message = message;
  }
  await AnalysisJob.findByIdAndUpdate(jobId, update);
}

export async function startWorker() {
  // Polling loop
  setInterval(async () => {
    if (activeWorkers >= MAX_CONCURRENCY) return;
    // Reserve a worker slot immediately to avoid race conditions
    activeWorkers++;
    try {
      const job = await claimNextJob();
      if (!job) {
        // No job available, release reserved slot
        activeWorkers--;
        return;
      }

      (async () => {
      const jobId = job._id.toString();
      try {
        await updateJobProgress(jobId, 1, 'Procesando job');

        // progress updater callback
        const progressUpdater = async (pct: number, msg?: string) => {
          await updateJobProgress(jobId, Math.min(100, Math.max(0, Math.round(pct))), msg);
        };

        await runProjectAnalysis(job.projectId.toString(), job.userId.toString(), progressUpdater);

        await AnalysisJob.findByIdAndUpdate(jobId, { status: 'completed', progress: 100, $push: { logs: { ts: new Date(), message: 'Completado' } } });

        // Audit event to notify user
        try {
          await recordAuditEvent({ userId: job.userId.toString(), action: 'project.analysis.completed', resourceType: 'project', resourceId: job.projectId.toString(), metadata: { jobId }, req: undefined as any });
        } catch (e) {
          console.warn('Could not record audit event for job completed', e);
        }
      } catch (err: any) {
        await AnalysisJob.findByIdAndUpdate(jobId, { status: 'failed', progress: 100, message: err?.message || 'Error', $push: { logs: { ts: new Date(), message: `Error: ${err?.message || String(err)}` } } });
      } finally {
        activeWorkers--;
      }
    })();
    } catch (e) {
      // Ensure reserved slot is released on unexpected errors
      if (activeWorkers > 0) activeWorkers--;
      console.error('Error claiming job or running worker loop', e);
    }
  }, 1000);
}

export default { enqueueAnalysis, getJobById, startWorker };
