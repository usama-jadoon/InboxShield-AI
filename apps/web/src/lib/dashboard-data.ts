/**
 * @file V1-05: dashboard data access (AC-04).
 *
 * Resolves the authenticated user's workspace from the session token and
 * returns real aggregate stats from the DB (via DashboardService). Returns
 * `null` when the token has no valid workspace so the page can render an
 * empty state rather than hardcoded demo data.
 */
import { prisma, WorkspaceService, DashboardService } from "@inboxshield/db";
import type { WorkspaceStats } from "@inboxshield/db";

export interface DashboardData {
  stats: WorkspaceStats;
  globalRiskLevel: string;
}

/** Canonical risk-level mapping (matches CLAUDE.md scoring formula). */
export function riskLevelForScore(score: number | null): string {
  if (score === null) return "UNKNOWN";
  if (score >= 90) return "LOW";
  if (score >= 70) return "MEDIUM";
  if (score >= 40) return "HIGH";
  return "CRITICAL";
}

export async function getDashboardData(
  token: string,
): Promise<DashboardData | null> {
  if (!token) return null;

  const workspace = await WorkspaceService.resolveForSession(prisma, token);
  if (!workspace) return null;

  const stats = await DashboardService.getWorkspaceStats(prisma, workspace.id);
  return { stats, globalRiskLevel: riskLevelForScore(stats.averageScore) };
}
