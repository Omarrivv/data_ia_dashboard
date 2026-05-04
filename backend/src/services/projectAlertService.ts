import { ProjectDocument } from '../models/Project';

export type ProjectAlertSeverity = 'warning' | 'critical';
export type ProjectAlertRuleId = 'reliability_warning' | 'reliability_critical';

export interface ProjectAlertEntry {
  ruleId: ProjectAlertRuleId;
  metric: 'reliabilityScore';
  severity: ProjectAlertSeverity;
  threshold: number;
  currentValue: number;
  message: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
}

export interface ProjectReliabilitySnapshot {
  score: number;
  alerts: ProjectAlertEntry[];
  activeAlerts: ProjectAlertEntry[];
  changed: boolean;
}

const ALERT_RULES = [
  {
    ruleId: 'reliability_critical' as const,
    severity: 'critical' as const,
    threshold: 40,
    message: 'La confiabilidad técnica cayó por debajo de 40%. Requiere atención inmediata.',
  },
  {
    ruleId: 'reliability_warning' as const,
    severity: 'warning' as const,
    threshold: 70,
    message: 'La confiabilidad técnica está por debajo de 70%. Conviene revisar calidad y cobertura.',
  },
];

export function calculateReliabilityScore(project: ProjectDocument): number {
  const stats = project.getStats();
  const datasets = project.datasets || [];

  let score = 100;
  if (!stats.totalDatasets) score -= 40;
  if (stats.totalRows === 0) score -= 30;
  if (!stats.hasDashboard) score -= 10;
  if (!stats.hasDocumentation) score -= 10;

  const totalNullable = datasets.reduce((sum: number, dataset: any) => {
    return sum + ((dataset.metadata?.columns || []).filter((column: any) => !!column.nullable).length || 0);
  }, 0);

  score -= Math.min(20, totalNullable * 2);
  return Math.max(0, Math.min(100, score));
}

function cloneAlerts(alerts: ProjectAlertEntry[] = []): ProjectAlertEntry[] {
  return alerts.map((alert) => ({ ...alert }));
}

export function syncReliabilityAlerts(project: ProjectDocument, score?: number): ProjectReliabilitySnapshot {
  const currentScore = typeof score === 'number' ? score : calculateReliabilityScore(project);
  const nextAlerts = cloneAlerts((project as any).alerts || []);
  let changed = false;

  const activeSeverity: ProjectAlertSeverity | null = currentScore < 40
    ? 'critical'
    : currentScore < 70
      ? 'warning'
      : null;

  const existingCritical = nextAlerts.find((alert) => alert.ruleId === 'reliability_critical');
  const existingWarning = nextAlerts.find((alert) => alert.ruleId === 'reliability_warning');

  const upsertAlert = (ruleId: ProjectAlertRuleId, severity: ProjectAlertSeverity, threshold: number, message: string) => {
    const now = new Date();
    const existing = nextAlerts.find((alert) => alert.ruleId === ruleId);
    if (existing) {
      if (
        !existing.active ||
        existing.currentValue !== currentScore ||
        existing.threshold !== threshold ||
        existing.severity !== severity
      ) {
        existing.active = true;
        existing.currentValue = currentScore;
        existing.threshold = threshold;
        existing.severity = severity;
        existing.message = message;
        existing.updatedAt = now;
        existing.resolvedAt = null;
        changed = true;
      }
      return;
    }

    nextAlerts.push({
      ruleId,
      metric: 'reliabilityScore',
      severity,
      threshold,
      currentValue: currentScore,
      message,
      active: true,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    });
    changed = true;
  };

  const resolveAlert = (alert: ProjectAlertEntry) => {
    if (alert.active) {
      alert.active = false;
      alert.resolvedAt = new Date();
      alert.updatedAt = new Date();
      changed = true;
    }
  };

  if (activeSeverity === 'critical') {
    upsertAlert(ALERT_RULES[0].ruleId, ALERT_RULES[0].severity, ALERT_RULES[0].threshold, ALERT_RULES[0].message);
    if (existingWarning) resolveAlert(existingWarning);
  } else if (activeSeverity === 'warning') {
    upsertAlert(ALERT_RULES[1].ruleId, ALERT_RULES[1].severity, ALERT_RULES[1].threshold, ALERT_RULES[1].message);
    if (existingCritical) resolveAlert(existingCritical);
  } else {
    if (existingCritical) resolveAlert(existingCritical);
    if (existingWarning) resolveAlert(existingWarning);
  }

  (project as any).alerts = nextAlerts;

  return {
    score: currentScore,
    alerts: nextAlerts,
    activeAlerts: nextAlerts.filter((alert) => alert.active),
    changed,
  };
}
