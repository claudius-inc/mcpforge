// Compute usage metering for hosted MCP servers
// Tracks server uptime in minutes, charged per-minute for active servers

import { getDb, generateId, initDb } from '@/lib/db';
import type { Tier } from '@/lib/auth/tiers';

export interface ComputeUsage {
  serverId: string;
  serverName: string;
  uptimeMinutes: number;
  cost: number;
}

export interface ComputeBilling {
  userId: string;
  tier: Tier;
  period: { start: string; end: string };
  servers: ComputeUsage[];
  totalMinutes: number;
  totalCost: number;
  includedMinutes: number;
  overage: number;
  overageCost: number;
}

// Per-tier included compute minutes per month
const INCLUDED_COMPUTE: Record<Tier, number> = {
  free: 0,         // no hosted servers
  pro: 10_000,     // ~167 hours / ~7 days
  team: 100_000,   // ~1667 hours / ~69 days
};

// Overage rate: $0.005 per minute ($0.30/hr)
const OVERAGE_RATE_PER_MINUTE = 0.005;

export function getIncludedMinutes(tier: Tier): number {
  return INCLUDED_COMPUTE[tier] || 0;
}

export function getOverageRate(): number {
  return OVERAGE_RATE_PER_MINUTE;
}

/**
 * Record a server's compute usage when it's stopped or at billing period end.
 */
export async function recordComputeUsage(
  serverId: string,
  userId: string,
  startTime: Date,
  endTime: Date
): Promise<void> {
  const db = getDb();
  await initDb();
  const minutes = Math.ceil((endTime.getTime() - startTime.getTime()) / 60_000);
  if (minutes <= 0) return;

  await db.execute({
    sql: `INSERT INTO compute_usage (id, server_id, user_id, start_time, end_time, minutes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [generateId(), serverId, userId, startTime.toISOString(), endTime.toISOString(), minutes],
  });
}

/**
 * Get compute billing summary for a user in the current billing period.
 */
export async function getComputeBilling(userId: string, tier: Tier): Promise<ComputeBilling> {
  const db = getDb();
  await initDb();

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Get usage per server
  const result = await db.execute({
    sql: `SELECT cu.server_id, s.name as server_name, SUM(cu.minutes) as total_minutes
          FROM compute_usage cu
          LEFT JOIN servers s ON s.id = cu.server_id
          WHERE cu.user_id = ? AND cu.start_time >= ? AND cu.end_time <= ?
          GROUP BY cu.server_id`,
    args: [userId, periodStart.toISOString(), periodEnd.toISOString()],
  });

  // Also add currently-running servers' live uptime
  const runningServers = await db.execute({
    sql: `SELECT id, name, last_started_at FROM servers WHERE user_id = ? AND status = 'running' AND last_started_at IS NOT NULL`,
    args: [userId],
  });

  const serverMap = new Map<string, ComputeUsage>();

  // Recorded usage
  for (const row of result.rows) {
    const serverId = row.server_id as string;
    serverMap.set(serverId, {
      serverId,
      serverName: (row.server_name as string) || 'Unknown',
      uptimeMinutes: Number(row.total_minutes) || 0,
      cost: 0,
    });
  }

  // Add live uptime for running servers
  for (const row of runningServers.rows) {
    const serverId = row.id as string;
    const startedAt = new Date(row.last_started_at as string);
    const liveMinutes = Math.ceil((now.getTime() - startedAt.getTime()) / 60_000);

    const existing = serverMap.get(serverId);
    if (existing) {
      existing.uptimeMinutes += liveMinutes;
    } else {
      serverMap.set(serverId, {
        serverId,
        serverName: (row.name as string) || 'Unknown',
        uptimeMinutes: liveMinutes,
        cost: 0,
      });
    }
  }

  const servers = Array.from(serverMap.values());
  const totalMinutes = servers.reduce((sum, s) => sum + s.uptimeMinutes, 0);
  const includedMinutes = getIncludedMinutes(tier);
  const overage = Math.max(0, totalMinutes - includedMinutes);
  const overageCost = overage * OVERAGE_RATE_PER_MINUTE;

  // Distribute cost proportionally
  if (totalMinutes > 0) {
    for (const server of servers) {
      const proportion = server.uptimeMinutes / totalMinutes;
      server.cost = overageCost * proportion;
    }
  }

  return {
    userId,
    tier,
    period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
    servers,
    totalMinutes,
    totalCost: overageCost,
    includedMinutes,
    overage,
    overageCost,
  };
}
