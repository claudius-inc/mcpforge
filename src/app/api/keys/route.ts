import { NextRequest, NextResponse } from 'next/server';
import { getSession, getTierConfig, checkLimit } from '@/lib/auth';
import { getDb, generateId, initDb } from '@/lib/db';
import { createHash, randomBytes } from 'crypto';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  await initDb();
  const result = await db.execute({
    sql: `SELECT id, name, scopes, last_used_at, expires_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
    args: [session.id],
  });

  return NextResponse.json({
    keys: result.rows.map(r => ({
      id: r.id,
      name: r.name,
      scopes: r.scopes,
      lastUsedAt: r.last_used_at,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  await initDb();

  // Check limit
  const countResult = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM api_keys WHERE user_id = ?',
    args: [session.id],
  });
  const currentCount = Number(countResult.rows[0]?.count || 0);
  const tier = getTierConfig(session.tier);
  const limitCheck = checkLimit(session.tier, 'apiKeysPerUser', currentCount);

  if (!limitCheck.allowed) {
    return NextResponse.json({
      error: `API key limit reached (${tier.limits.apiKeysPerUser}). Upgrade for more.`,
    }, { status: 403 });
  }

  const body = await req.json();
  const name = (body.name || 'default').slice(0, 64);
  const scopes = (body.scopes || 'generate').slice(0, 128);

  // Generate key
  const rawKey = `mcf_${randomBytes(24).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const id = generateId();

  await db.execute({
    sql: `INSERT INTO api_keys (id, user_id, key_hash, name, scopes) VALUES (?, ?, ?, ?, ?)`,
    args: [id, session.id, keyHash, name, scopes],
  });

  return NextResponse.json({
    key: rawKey, // shown once
    apiKey: { id, name, scopes, lastUsedAt: null, expiresAt: null, createdAt: new Date().toISOString() },
  });
}
