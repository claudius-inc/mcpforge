// GET /api/servers/[id] — Get server details
// PATCH /api/servers/[id] — Update server config
// DELETE /api/servers/[id] — Destroy server

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb, initDb, generateId } from '@/lib/db';
import { getProvider, validateServerName } from '@/lib/hosting';

async function getOwnedServer(serverId: string, userId: string) {
  const db = getDb();
  await initDb();
  const result = await db.execute({
    sql: 'SELECT * FROM servers WHERE id = ? AND user_id = ?',
    args: [serverId, userId],
  });
  return result.rows[0] || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const server = await getOwnedServer(id, session.id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  // Get env var keys (not values for security)
  const db = getDb();
  const envResult = await db.execute({
    sql: 'SELECT id, key, is_secret, created_at, updated_at FROM server_env_vars WHERE server_id = ?',
    args: [id],
  });

  // Get version history
  const versionsResult = await db.execute({
    sql: `SELECT id, version_number, tool_count, deployed_at, status, created_at 
          FROM server_versions WHERE server_id = ? ORDER BY version_number DESC LIMIT 10`,
    args: [id],
  });

  // Get live info from provider if available
  let liveInfo = null;
  if (server.provider_id) {
    try {
      const provider = getProvider();
      liveInfo = await provider.info(server.provider_id as string);
    } catch {
      // Provider might not have this server anymore
    }
  }

  return NextResponse.json({
    server: {
      id: server.id,
      name: server.name,
      slug: server.slug,
      description: server.description,
      status: liveInfo?.status || server.status,
      language: server.language,
      toolCount: server.tool_count,
      provider: server.provider,
      endpointUrl: server.endpoint_url,
      healthStatus: liveInfo?.health || server.health_status,
      autoRestart: Boolean(server.auto_restart),
      visibility: server.visibility,
      uptime: liveInfo?.uptime,
      lastStartedAt: server.last_started_at,
      lastStoppedAt: server.last_stopped_at,
      createdAt: server.created_at,
      updatedAt: server.updated_at,
    },
    envVars: envResult.rows.map(r => ({
      id: r.id, key: r.key, isSecret: Boolean(r.is_secret),
      createdAt: r.created_at, updatedAt: r.updated_at,
    })),
    versions: versionsResult.rows.map(r => ({
      id: r.id, versionNumber: r.version_number, toolCount: r.tool_count,
      deployedAt: r.deployed_at, status: r.status, createdAt: r.created_at,
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const server = await getOwnedServer(id, session.id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  let body: {
    name?: string;
    description?: string;
    autoRestart?: boolean;
    visibility?: 'private' | 'public';
    action?: 'start' | 'stop' | 'restart';
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = getDb();
  const provider = getProvider();

  // Handle lifecycle actions
  if (body.action) {
    const providerId = server.provider_id as string;
    if (!providerId) {
      return NextResponse.json({ error: 'No deployment found for this server' }, { status: 400 });
    }

    try {
      switch (body.action) {
        case 'start':
          await provider.start(providerId);
          await db.execute({
            sql: `UPDATE servers SET status = 'running', last_started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
            args: [id],
          });
          await db.execute({
            sql: `INSERT INTO server_logs (id, server_id, level, message) VALUES (?, ?, 'info', 'Server started')`,
            args: [generateId(), id],
          });
          break;

        case 'stop':
          await provider.stop(providerId);
          await db.execute({
            sql: `UPDATE servers SET status = 'stopped', last_stopped_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
            args: [id],
          });
          await db.execute({
            sql: `INSERT INTO server_logs (id, server_id, level, message) VALUES (?, ?, 'info', 'Server stopped')`,
            args: [generateId(), id],
          });
          break;

        case 'restart':
          await provider.stop(providerId);
          await provider.start(providerId);
          await db.execute({
            sql: `UPDATE servers SET status = 'running', last_started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
            args: [id],
          });
          await db.execute({
            sql: `INSERT INTO server_logs (id, server_id, level, message) VALUES (?, ?, 'info', 'Server restarted')`,
            args: [generateId(), id],
          });
          break;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Action failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: body.action });
  }

  // Handle config updates
  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (body.name !== undefined) {
    const nameCheck = validateServerName(body.name);
    if (!nameCheck.valid) return NextResponse.json({ error: nameCheck.error }, { status: 400 });
    updates.push('name = ?');
    args.push(body.name);
  }

  if (body.description !== undefined) {
    updates.push('description = ?');
    args.push(body.description);
  }

  if (body.autoRestart !== undefined) {
    updates.push('auto_restart = ?');
    args.push(body.autoRestart ? 1 : 0);
  }

  if (body.visibility !== undefined) {
    updates.push('visibility = ?');
    args.push(body.visibility);
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    args.push(id);
    await db.execute({
      sql: `UPDATE servers SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const server = await getOwnedServer(id, session.id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  // Destroy in provider
  if (server.provider_id) {
    try {
      const provider = getProvider();
      await provider.destroy(server.provider_id as string);
    } catch {
      // Provider cleanup failure is non-fatal
    }
  }

  // Delete from DB (cascade handles env vars, logs, analytics, versions)
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM server_logs WHERE server_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM server_analytics WHERE server_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM server_versions WHERE server_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM server_env_vars WHERE server_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM servers WHERE id = ?', args: [id] });

  return NextResponse.json({ ok: true });
}
