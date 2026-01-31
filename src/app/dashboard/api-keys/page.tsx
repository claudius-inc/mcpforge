import { redirect } from 'next/navigation';
import { getSession, getTierConfig } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';
import { ApiKeyManager } from '@/components/ApiKeyManager';

async function getApiKeys(userId: string) {
  const db = getDb();
  await initDb();
  const result = await db.execute({
    sql: `SELECT id, name, scopes, last_used_at, expires_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
    args: [userId],
  });
  return result.rows.map(r => ({
    id: r.id as string,
    name: r.name as string,
    scopes: r.scopes as string,
    lastUsedAt: r.last_used_at as string | null,
    expiresAt: r.expires_at as string | null,
    createdAt: r.created_at as string,
  }));
}

export default async function ApiKeysPage() {
  const session = await getSession();
  if (!session) redirect('/login?callbackUrl=/dashboard/api-keys');

  const keys = await getApiKeys(session.id);
  const tier = getTierConfig(session.tier);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <a href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">← Dashboard</a>
        <h1 className="text-2xl font-bold mt-2">API Keys</h1>
        <p className="text-gray-400 text-sm mt-1">
          Manage API keys for programmatic access. {keys.length} / {tier.limits.apiKeysPerUser} keys used.
        </p>
      </div>

      <ApiKeyManager
        keys={keys}
        maxKeys={tier.limits.apiKeysPerUser}
        currentCount={keys.length}
      />
    </div>
  );
}
