// ============================================================================
// Health Check Endpoint — monitoring & deployment verification
// ============================================================================

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const startMs = Date.now();
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // Database connectivity
  try {
    const dbStart = Date.now();
    const db = getDb();
    await db.execute('SELECT 1 as ping');
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (e) {
    checks.database = { ok: false, error: e instanceof Error ? e.message : 'Unknown DB error' };
  }

  // Environment (verify critical vars are set without leaking values)
  const requiredEnvVars = ['TURSO_DATABASE_URL'];
  const optionalEnvVars = ['NEXTAUTH_SECRET', 'GITHUB_CLIENT_ID', 'STRIPE_SECRET_KEY'];
  const missingRequired = requiredEnvVars.filter((v) => !process.env[v]);
  const missingOptional = optionalEnvVars.filter((v) => !process.env[v]);
  checks.environment = {
    ok: missingRequired.length === 0,
    ...(missingRequired.length > 0 ? { error: `Missing required: ${missingRequired.join(', ')}` } : {}),
    ...(missingOptional.length > 0 ? { error: `Missing optional: ${missingOptional.join(', ')}` } : {}),
  };

  const allHealthy = Object.values(checks).every((c) => c.ok);
  const totalMs = Date.now() - startMs;

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      service: 'mcpforge',
      version: process.env.npm_package_version || '0.1.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      latencyMs: totalMs,
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  );
}
