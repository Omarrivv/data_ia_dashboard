type PathMetrics = {
  count: number;
  errors: number;
  totalDurationMs: number;
};

const metrics = {
  startTime: new Date(),
  totalRequests: 0,
  totalErrors: 0,
  paths: {} as Record<string, PathMetrics>,
};

export function recordRequest(path: string, method: string, status: number, durationMs: number) {
  metrics.totalRequests += 1;
  if (status >= 500) metrics.totalErrors += 1;

  const key = `${method} ${path}`;
  if (!metrics.paths[key]) metrics.paths[key] = { count: 0, errors: 0, totalDurationMs: 0 };
  metrics.paths[key].count += 1;
  metrics.paths[key].totalDurationMs += durationMs;
  if (status >= 500) metrics.paths[key].errors += 1;
}

export function getMetrics() {
  const uptimeSec = Math.round((Date.now() - metrics.startTime.getTime()) / 1000);
  const pathsSummary: Record<string, any> = {};
  for (const k of Object.keys(metrics.paths)) {
    const p = metrics.paths[k];
    pathsSummary[k] = {
      count: p.count,
      errors: p.errors,
      avgDurationMs: p.count ? Math.round(p.totalDurationMs / p.count) : 0,
    };
  }
  return {
    uptimeSec,
    totalRequests: metrics.totalRequests,
    totalErrors: metrics.totalErrors,
    paths: pathsSummary,
    since: metrics.startTime.toISOString(),
  };
}

export default { recordRequest, getMetrics };
