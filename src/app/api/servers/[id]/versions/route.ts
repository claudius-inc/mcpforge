// GET /api/servers/[id]/versions — List deployment versions
// POST /api/servers/[id]/versions — Deploy new version (redeploy with new spec/code)

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb, initDb, generateId } from '@/lib/db';
import { getProvider } from '@/lib/hosting';
import { hasFeature } from '@/lib/auth/tiers';
import type { ServerConfig } from '@/lib/hosting/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  await initDb();

  const server = await db.execute({
    sql: 'SELECT id FROM servers WHERE id = ? AND user_id = ?',
    args: [id, session.id],
  });
  if (server.rows.length === 0) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  const result = await db.execute({
    sql: `SELECT id, version_number, tool_count, deployed_at, status, rollback_of, created_at
          FROM server_versions WHERE server_id = ? ORDER BY version_number DESC`,
    args: [id],
  });

  return NextResponse.json({
    versions: result.rows.map(r => ({
      id: r.id,
      versionNumber: r.version_number,
      toolCount: r.tool_count,
      deployedAt: r.deployed_at,
      status: r.status,
      rollbackOf: r.rollback_of,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!hasFeature(session.tier, 'versionHistory')) {
    return NextResponse.json({ error: 'Version management requires a Pro or Team plan' }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();
  await initDb();

  const serverResult = await db.execute({
    sql: 'SELECT * FROM servers WHERE id = ? AND user_id = ?',
    args: [id, session.id],
  });
  if (serverResult.rows.length === 0) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }
  const server = serverResult.rows[0];

  let body: {
    specSnapshot: string;
    generatedCode: string;
    toolCount?: number;
    rollbackTo?: number; // version number to roll back to
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Get next version number
  const maxVersion = await db.execute({
    sql: 'SELECT MAX(version_number) as maxv FROM server_versions WHERE server_id = ?',
    args: [id],
  });
  const nextVersion = (Number(maxVersion.rows[0].maxv) || 0) + 1;

  // Mark old active version as superseded
  await db.execute({
    sql: `UPDATE server_versions SET status = 'superseded' WHERE server_id = ? AND status = 'active'`,
    args: [id],
  });

  // Create new version record
  const versionId = generateId();
  await db.execute({
    sql: `INSERT INTO server_versions (id, server_id, version_number, spec_snapshot, tool_count, status, rollback_of)
          VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    args: [versionId, id, nextVersion, body.specSnapshot, body.toolCount || 0, body.rollbackTo ? String(body.rollbackTo) : null],
  });

  // Redeploy with new code
  if (server.provider_id) {
    try {
      // Get current env vars for the server
      const envResult = await db.execute({
        sql: 'SELECT key, value FROM server_env_vars WHERE server_id = ?',
        args: [id],
      });
      const envVars: Record<string, string> = {};
      for (const row of envResult.rows) {
        envVars[row.key as string] = row.value as string;
      }

      const provider = getProvider();
      const config: ServerConfig = {
        id: id,
        name: server.name as string,
        slug: server.slug as string,
        language: (server.language as 'typescript' | 'python') || 'typescript',
        envVars,
        autoRestart: Boolean(server.auto_restart),
        generatedCode: body.generatedCode,
        specSnapshot: body.specSnapshot,
      };

      const result = await provider.redeploy(server.provider_id as string, config);

      // Update server record
      await db.execute({
        sql: `UPDATE servers SET spec_snapshot = ?, tool_count = ?, endpoint_url = ?, 
              status = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [body.specSnapshot, body.toolCount || 0, result.endpointUrl, result.status, id],
      });

      // Mark version as active
      await db.execute({
        sql: `UPDATE server_versions SET status = 'active', deployed_at = datetime('now') WHERE id = ?`,
        args: [versionId],
      });

      await db.execute({
        sql: `INSERT INTO server_logs (id, server_id, level, message, metadata) VALUES (?, ?, 'info', ?, ?)`,
        args: [generateId(), id, `Deployed version ${nextVersion}`, JSON.stringify({ toolCount: body.toolCount, rollbackTo: body.rollbackTo })],
      });

      return NextResponse.json({
        version: { id: versionId, versionNumber: nextVersion, status: 'active' },
        endpointUrl: result.endpointUrl,
      }, { status: 201 });

    } catch (e: unknown) {
      // Mark version as failed
      await db.execute({
        sql: `UPDATE server_versions SET status = 'failed' WHERE id = ?`,
        args: [versionId],
      });
      const msg = e instanceof Error ? e.message : 'Redeploy failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'No active deployment to update' }, { status: 400 });
}
