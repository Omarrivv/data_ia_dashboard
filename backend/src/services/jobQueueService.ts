import { AnalysisJob } from '../models/AnalysisJob';
import { runProjectAnalysis } from './projectAnalysisService';
import { Project } from '../models/Project';
import { recordAuditEvent } from './auditService';

let activeWorkers = 0;
const MAX_CONCURRENCY = parseInt(process.env.ANALYSIS_CONCURRENCY || '2');
const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '1000');
const JOB_TIMEOUT_MS = parseInt(process.env.JOB_TIMEOUT_MS || '3600000'); // 1 hora

interface JobMetrics {
  processedJobs: number;
  failedJobs: number;
  avgProcessingTime: number;
}

const metrics: JobMetrics = {
  processedJobs: 0,
  failedJobs: 0,
  avgProcessingTime: 0
};

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

/**
 * Get job metrics for monitoring
 */
export function getJobMetrics() {
  return {
    ...metrics,
    activeWorkers,
    maxConcurrency: MAX_CONCURRENCY,
    pollIntervalMs: POLL_INTERVAL
  };
}

async function claimNextJob() {
  // Find oldest queued job and mark processing atomically
  const job = await AnalysisJob.findOneAndUpdate(
    { status: 'queued' },
    { status: 'processing', progress: 0, startedAt: new Date() },
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

/**
 * Senior-level worker with proper error handling, timeouts, and metrics
 */
export async function startWorker() {
  console.info('[JobQueue] Worker started', {
    maxConcurrency: MAX_CONCURRENCY,
    pollInterval: POLL_INTERVAL
  });

  // Polling loop with exponential backoff
  setInterval(async () => {
    if (activeWorkers >= MAX_CONCURRENCY) return;

    try {
      // Reserve a worker slot immediately to avoid race conditions
      activeWorkers++;

      const job = await claimNextJob();
      if (!job) {
        // No job available, release reserved slot
        activeWorkers--;
        return;
      }

      // Process job asynchronously
      processJobWithTimeout(job).catch((error) => {
        console.error('[JobQueue] Unhandled job error:', error);
        activeWorkers--;
      });
    } catch (e) {
      // Ensure reserved slot is released on unexpected errors
      if (activeWorkers > 0) activeWorkers--;
      console.error('[JobQueue] Worker loop error:', e);
    }
  }, POLL_INTERVAL);
}

/**
 * Process job with timeout and proper cleanup
 */
async function processJobWithTimeout(job: any) {
  const jobId = job._id.toString();
  const startTime = Date.now();
  let completed = false;

  try {
    await updateJobProgress(jobId, 1, 'Iniciando análisis...');

    // progress updater callback
    const progressUpdater = async (pct: number, msg?: string) => {
      await updateJobProgress(jobId, Math.min(100, Math.max(0, Math.round(pct))), msg);
    };

    // Run with timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Job timeout after ${JOB_TIMEOUT_MS}ms`)), JOB_TIMEOUT_MS)
    );

    await Promise.race([
      runProjectAnalysis(job.projectId.toString(), job.userId.toString(), progressUpdater),
      timeoutPromise
    ]);

    completed = true;
    const duration = Date.now() - startTime;
    metrics.processedJobs++;
    metrics.avgProcessingTime = (metrics.avgProcessingTime * (metrics.processedJobs - 1) + duration) / metrics.processedJobs;

    await AnalysisJob.findByIdAndUpdate(jobId, {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
      duration,
      $push: { logs: { ts: new Date(), message: 'Análisis completado exitosamente' } }
    });

    // Audit event to notify user
    try {
      await recordAuditEvent({
        userId: job.userId.toString(),
        action: 'project.analysis.completed',
        resourceType: 'project',
        resourceId: job.projectId.toString(),
        metadata: { jobId, duration },
        req: undefined as any
      });
    } catch (e) {
      console.warn('[JobQueue] Could not record audit event for job completed', e);
    }
  } catch (err: any) {
    completed = true;
    metrics.failedJobs++;
    const errorMsg = err?.message || String(err);

    console.error('[JobQueue] Job failed:', { jobId, error: errorMsg });

    await AnalysisJob.findByIdAndUpdate(jobId, {
      status: 'failed',
      progress: 100,
      completedAt: new Date(),
      message: errorMsg,
      $push: { logs: { ts: new Date(), message: `Error: ${errorMsg}` } }
    });
  } finally {
    activeWorkers--;
    if (completed) {
      console.info('[JobQueue] Job processed', {
        jobId,
        duration: Date.now() - startTime,
        activeWorkers
      });
    }
  }
}
