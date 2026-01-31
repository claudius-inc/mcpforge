import { createClient, type Client } from '@libsql/client';

let _client: Client | null = null;

export function getDb(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL || 'file:./mcpforge.db';
    const authToken = process.env.TURSO_AUTH_TOKEN;
    _client = createClient({ url, authToken });
  }
  return _client;
}

export async function initDb(): Promise<void> {
  const { SCHEMA_SQL } = await import('./schema');
  const db = getDb();
  const statements = SCHEMA_SQL.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    await db.execute(stmt);
  }
}

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}
