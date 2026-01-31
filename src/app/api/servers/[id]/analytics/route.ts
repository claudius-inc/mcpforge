// GET /api/servers/[id]/analytics — Usage analytics for a hosted server

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';
import { hasFeature } from '@/lib/auth/tiers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!hasFeature(session.tier, 'analytics')) {
    return NextResponse.json({ error: 'Analytics require a Pro or Team plan' }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();
  await initDb();

  // Verify ownership
  const server = await db.execute({
    sql: 'SELECT id FROM servers WHERE id = ? AND user_id = ?',
    args: [id, session.id],
  });
  if (server.rows.length === 0) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  const searchParams = req.nextUrl.searchParams;
  const period = searchParams.get('period') || '7d'; // 1d, 7d, 30d
  
  let dateFilter: string;
  switch (period) {
    case '1d': dateFilter = "datetime('now', '-1 day')"; break;
    case '30d': dateFilter = "datetime('now', '-30 days')"; break;
    default: dateFilter = "datetime('now', '-7 days')"; break;
  }

  // Total calls
  const totalResult = await db.execute({
    sql: `SELECT COUNT(*) as total FROM server_analytics WHERE server_id = ? AND created_at >= ${dateFilter}`,
    args: [id],
  });
  const totalCalls = Number(totalResult.rows[0].total);

  // Success / error counts
  const statusResult = await db.execute({
    sql: `SELECT status, COUNT(*) as cnt FROM server_analytics 
          WHERE server_id = ? AND created_at >= ${dateFilter} GROUP BY status`,
    args: [id],
  });
  let successCount = 0;
  let errorCount = 0;
  for (const row of statusResult.rows) {
    if (row.status === 'success') successCount = Number(row.cnt);
    else errorCount += Number(row.cnt);
  }

  // Average latency
  const latencyResult = await db.execute({
    sql: `SELECT AVG(latency_ms) as avg_latency, 
          MIN(latency_ms) as min_latency,
          MAX(latency_ms) as max_latency
          FROM server_analytics 
          WHERE server_id = ? AND created_at >= ${dateFilter} AND status = 'success'`,
    args: [id],
  });
  const avgLatency = Math.round(Number(latencyResult.rows[0].avg_latency) || 0);
  const minLatency = Number(latencyResult.rows[0].min_latency) || 0;
  const maxLatency = Number(latencyResult.rows[0].max_latency) || 0;

  // Top tools by usage
  const topToolsResult = await db.execute({
    sql: `SELECT tool_name, COUNT(*) as calls, 
          AVG(latency_ms) as avg_latency,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
          FROM server_analytics 
          WHERE server_id = ? AND created_at >= ${dateFilter}
          GROUP BY tool_name ORDER BY calls DESC LIMIT 10`,
    args: [id],
  });

  // Daily breakdown
  const dailyResult = await db.execute({
    sql: `SELECT DATE(created_at) as day, COUNT(*) as calls,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
          FROM server_analytics 
          WHERE server_id = ? AND created_at >= ${dateFilter}
          GROUP BY DATE(created_at) ORDER BY day`,
    args: [id],
  });

  // Recent errors
  const errorsResult = await db.execute({
    sql: `SELECT tool_name, error_message, created_at FROM server_analytics 
          WHERE server_id = ? AND status = 'error' AND created_at >= ${dateFilter}
          ORDER BY created_at DESC LIMIT 10`,
    args: [id],
  });

  return NextResponse.json({
    period,
    summary: {
      totalCalls,
      successRate: totalCalls > 0 ? Math.round((successCount / totalCalls) * 100) : 0,
      errorRate: totalCalls > 0 ? Math.round((errorCount / totalCalls) * 100) : 0,
      avgLatencyMs: avgLatency,
      minLatencyMs: minLatency,
      maxLatencyMs: maxLatency,
    },
    topTools: topToolsResult.rows.map(r => ({
      name: r.tool_name,
      calls: Number(r.calls),
      avgLatencyMs: Math.round(Number(r.avg_latency) || 0),
      errors: Number(r.errors),
    })),
    daily: dailyResult.rows.map(r => ({
      date: r.day,
      calls: Number(r.calls),
      errors: Number(r.errors),
    })),
    recentErrors: errorsResult.rows.map(r => ({
      toolName: r.tool_name,
      error: r.error_message,
      timestamp: r.created_at,
    })),
  });
}
