// GET /api/servers/[id]/env — List env var keys (not values)
// PUT /api/servers/[id]/env — Set/update env vars
// DELETE /api/servers/[id]/env — Delete specific env vars

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb, initDb, generateId } from '@/lib/db';
import { getProvider } from '@/lib/hosting';

async function verifyOwnership(serverId: string, userId: string) {
  const db = getDb();
  await initDb();
  const result = await db.execute({
    sql: 'SELECT id, provider_id FROM servers WHERE id = ? AND user_id = ?',
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
  const server = await verifyOwnership(id, session.id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, key, is_secret, created_at, updated_at FROM server_env_vars WHERE server_id = ? ORDER BY key`,
    args: [id],
  });

  return NextResponse.json({
    envVars: result.rows.map(r => ({
      id: r.id,
      key: r.key,
      value: r.is_secret ? '••••••••' : undefined, // Never expose secret values via API
      isSecret: Boolean(r.is_secret),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const server = await verifyOwnership(id, session.id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  let body: { vars: Array<{ key: string; value: string; isSecret?: boolean }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.vars || !Array.isArray(body.vars)) {
    return NextResponse.json({ error: 'vars array is required' }, { status: 400 });
  }

  // Validate keys
  const keyPattern = /^[A-Z][A-Z0-9_]*$/;
  for (const v of body.vars) {
    if (!v.key || !keyPattern.test(v.key)) {
      return NextResponse.json(
        { error: `Invalid env var key: "${v.key}". Must be UPPER_SNAKE_CASE` },
        { status: 400 }
      );
    }
    if (v.value === undefined || v.value === null) {
      return NextResponse.json({ error: `Value required for key: ${v.key}` }, { status: 400 });
    }
  }

  const db = getDb();
  const envForProvider: Record<string, string> = {};

  for (const v of body.vars) {
    // Upsert env var
    const existing = await db.execute({
      sql: 'SELECT id FROM server_env_vars WHERE server_id = ? AND key = ?',
      args: [id, v.key],
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: `UPDATE server_env_vars SET value = ?, is_secret = ?, updated_at = datetime('now') WHERE server_id = ? AND key = ?`,
        args: [v.value, v.isSecret !== false ? 1 : 0, id, v.key],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO server_env_vars (id, server_id, key, value, is_secret) VALUES (?, ?, ?, ?, ?)`,
        args: [generateId(), id, v.key, v.value, v.isSecret !== false ? 1 : 0],
      });
    }

    envForProvider[v.key] = v.value;
  }

  // Push to provider (triggers restart if running)
  if (server.provider_id) {
    try {
      const provider = getProvider();
      await provider.updateEnv(server.provider_id as string, envForProvider);
    } catch {
      // Non-fatal — DB is updated even if provider push fails
    }
  }

  // Log the change
  await db.execute({
    sql: `INSERT INTO server_logs (id, server_id, level, message, metadata) VALUES (?, ?, 'info', 'Environment variables updated', ?)`,
    args: [generateId(), id, JSON.stringify({ keys: body.vars.map(v => v.key) })],
  });

  return NextResponse.json({ ok: true, updated: body.vars.length });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const server = await verifyOwnership(id, session.id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  let body: { keys: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.keys || !Array.isArray(body.keys)) {
    return NextResponse.json({ error: 'keys array is required' }, { status: 400 });
  }

  const db = getDb();
  for (const key of body.keys) {
    await db.execute({
      sql: 'DELETE FROM server_env_vars WHERE server_id = ? AND key = ?',
      args: [id, key],
    });
  }

  return NextResponse.json({ ok: true, deleted: body.keys.length });
}
