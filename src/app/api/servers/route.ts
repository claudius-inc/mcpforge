// POST /api/servers — Deploy a new hosted MCP server
// GET /api/servers — List user's servers

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb, initDb, generateId } from '@/lib/db';
import { getProvider, generateSlug, validateServerName } from '@/lib/hosting';
import { checkLimit, hasFeature } from '@/lib/auth/tiers';
import type { ServerConfig } from '@/lib/hosting/types';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  await initDb();

  const result = await db.execute({
    sql: `SELECT id, name, slug, description, status, language, tool_count, 
           provider, endpoint_url, health_status, health_checked_at,
           last_started_at, last_stopped_at, auto_restart, visibility,
           created_at, updated_at
    FROM servers WHERE user_id = ? ORDER BY created_at DESC`,
    args: [session.id],
  });

  const servers = result.rows.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    status: r.status,
    language: r.language,
    toolCount: r.tool_count,
    provider: r.provider,
    endpointUrl: r.endpoint_url,
    healthStatus: r.health_status,
    healthCheckedAt: r.health_checked_at,
    lastStartedAt: r.last_started_at,
    lastStoppedAt: r.last_stopped_at,
    autoRestart: Boolean(r.auto_restart),
    visibility: r.visibility,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json({ servers });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check tier feature gate
  if (!hasFeature(session.tier, 'hostedDeploy')) {
    return NextResponse.json(
      { error: 'Hosted servers require a Pro or Team plan' },
      { status: 403 }
    );
  }

  const db = getDb();
  await initDb();

  // Check server limit
  const countResult = await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM servers WHERE user_id = ?',
    args: [session.id],
  });
  const currentCount = Number(countResult.rows[0].cnt);
  const limitCheck = checkLimit(session.tier, 'hostedServers', currentCount);

  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: `Server limit reached (${limitCheck.limit}). Upgrade your plan for more.`, limit: limitCheck.limit },
      { status: 403 }
    );
  }

  let body: {
    name: string;
    description?: string;
    language?: 'typescript' | 'python';
    specSnapshot: string;
    generatedCode: string;
    toolCount?: number;
    envVars?: Record<string, string>;
    autoRestart?: boolean;
    visibility?: 'private' | 'public';
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate name
  const nameCheck = validateServerName(body.name);
  if (!nameCheck.valid) {
    return NextResponse.json({ error: nameCheck.error }, { status: 400 });
  }

  if (!body.specSnapshot || !body.generatedCode) {
    return NextResponse.json({ error: 'specSnapshot and generatedCode are required' }, { status: 400 });
  }

  const serverId = generateId();
  const slug = generateSlug(body.name, session.id);
  const language = body.language || 'typescript';
  const envVars = body.envVars || {};

  // Check slug uniqueness
  const slugCheck = await db.execute({
    sql: 'SELECT id FROM servers WHERE slug = ?',
    args: [slug],
  });
  if (slugCheck.rows.length > 0) {
    return NextResponse.json({ error: 'A server with a similar name already exists' }, { status: 409 });
  }

  // Deploy to provider
  const provider = getProvider();
  const config: ServerConfig = {
    id: serverId,
    name: body.name,
    slug,
    language,
    envVars,
    autoRestart: body.autoRestart ?? true,
    generatedCode: body.generatedCode,
    specSnapshot: body.specSnapshot,
  };

  let deployResult;
  try {
    deployResult = await provider.deploy(config);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Deploy failed';
    return NextResponse.json({ error: `Deployment failed: ${msg}` }, { status: 500 });
  }

  // Save to database
  await db.execute({
    sql: `INSERT INTO servers (id, user_id, name, slug, description, status, language, 
          spec_snapshot, tool_count, provider, provider_id, endpoint_url, 
          auto_restart, visibility, last_started_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      serverId, session.id, body.name, slug, body.description || null,
      deployResult.status, language, body.specSnapshot, body.toolCount || 0,
      provider.type, deployResult.providerId, deployResult.endpointUrl,
      body.autoRestart ? 1 : 0, body.visibility || 'private',
    ],
  });

  // Save env vars
  for (const [key, value] of Object.entries(envVars)) {
    await db.execute({
      sql: `INSERT INTO server_env_vars (id, server_id, key, value, is_secret) VALUES (?, ?, ?, ?, 1)`,
      args: [generateId(), serverId, key, value],
    });
  }

  // Save initial version
  await db.execute({
    sql: `INSERT INTO server_versions (id, server_id, version_number, spec_snapshot, tool_count, deployed_at, status)
          VALUES (?, ?, 1, ?, ?, datetime('now'), 'active')`,
    args: [generateId(), serverId, body.specSnapshot, body.toolCount || 0],
  });

  // Log deployment
  await db.execute({
    sql: `INSERT INTO server_logs (id, server_id, level, message, metadata) VALUES (?, ?, 'info', ?, ?)`,
    args: [generateId(), serverId, 'Server deployed and started', JSON.stringify({ provider: provider.type, endpoint: deployResult.endpointUrl })],
  });

  return NextResponse.json({
    server: {
      id: serverId,
      name: body.name,
      slug,
      status: deployResult.status,
      endpointUrl: deployResult.endpointUrl,
      language,
      toolCount: body.toolCount || 0,
    },
  }, { status: 201 });
}
