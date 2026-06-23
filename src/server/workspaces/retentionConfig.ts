import "server-only";

export function getRetentionDays(): number {
  const raw = process.env.WORKSPACE_RETENTION_DAYS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}
