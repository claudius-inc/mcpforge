// GET /api/servers/[id]/logs — Fetch server logs (DB + live from provider)

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';
import { getProvider } from '@/lib/hosting';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  await initDb();

  // Verify ownership
  const server = await db.execute({
    sql: 'SELECT id, provider_id FROM servers WHERE id = ? AND user_id = ?',
    args: [id, session.id],
  });
  if (server.rows.length === 0) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(Number(searchParams.get('limit') || 100), 500);
  const level = searchParams.get('level'); // filter by level
  const source = searchParams.get('source') || 'all'; // 'db', 'live', 'all'

  const logs: Array<{
    timestamp: string;
    level: string;
    message: string;
    metadata?: string | null;
    source: string;
  }> = [];

  // DB logs
  if (source === 'all' || source === 'db') {
    let sql = `SELECT level, message, metadata, created_at FROM server_logs WHERE server_id = ?`;
    const args: (string | number)[] = [id];

    if (level) {
      sql += ' AND level = ?';
      args.push(level);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    args.push(limit);

    const dbLogs = await db.execute({ sql, args });
    for (const row of dbLogs.rows) {
      logs.push({
        timestamp: row.created_at as string,
        level: row.level as string,
        message: row.message as string,
        metadata: row.metadata as string | null,
        source: 'db',
      });
    }
  }

  // Live logs from provider
  if ((source === 'all' || source === 'live') && server.rows[0].provider_id) {
    try {
      const provider = getProvider();
      const liveLogs = await provider.logs(server.rows[0].provider_id as string, limit);
      for (const entry of liveLogs) {
        logs.push({
          timestamp: entry.timestamp,
          level: entry.level,
          message: entry.message,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          source: 'live',
        });
      }
    } catch {
      // Provider might not be available
    }
  }

  // Sort combined logs by timestamp descending
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ logs: logs.slice(0, limit) });
}
