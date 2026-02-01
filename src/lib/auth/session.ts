import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { getDb, initDb } from '@/lib/db';
import type { Tier } from './tiers';

export interface UserSession {
  id: string;
  username: string;
  tier: Tier;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

export async function getSession(): Promise<UserSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    username: session.user.username,
    tier: session.user.tier || 'free',
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  };
}

export async function getMonthlyUsage(userId: string, type: string = 'generate'): Promise<number> {
  const db = getDb();
  await initDb();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM generations WHERE user_id = ? AND type = ? AND created_at >= ?`,
    args: [userId, type, firstOfMonth],
  });
  return Number(result.rows[0]?.count || 0);
}

export async function trackGeneration(
  userId: string | null,
  anonymousId: string | null,
  type: string,
  specName: string,
  toolCount: number,
  language: string
): Promise<void> {
  const db = getDb();
  await initDb();
  const { generateId } = await import('@/lib/db');
  await db.execute({
    sql: `INSERT INTO generations (id, user_id, anonymous_id, type, spec_name, tool_count, language) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [generateId(), userId, anonymousId, type, specName, toolCount, language],
  });
}
