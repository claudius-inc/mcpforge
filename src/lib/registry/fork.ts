// Registry fork functions — clone community servers

import { getDb, initDb, generateId } from '@/lib/db';
import { getRegistryListing } from './browse';
import type { RegistryListing } from './types';

export interface ForkResult {
  listing: RegistryListing;
  serverId: string | null;
  forkId: string;
}

export async function forkListing(
  listingId: string,
  userId: string,
  options?: {
    createServer?: boolean; // Also create a hosted server from the fork
    customName?: string;
  }
): Promise<ForkResult> {
  const db = getDb();
  await initDb();

  // Get source listing
  const source = await getRegistryListing(listingId);
  if (!source) throw new Error('Listing not found');
  if (source.status !== 'published') throw new Error('Cannot fork unlisted or suspended listing');

  // Check if user already forked this
  const existing = await db.execute({
    sql: `SELECT id FROM registry_forks WHERE source_listing_id = ? AND forked_by_user_id = ?`,
    args: [listingId, userId],
  });
  if (existing.rows.length > 0) {
    throw new Error('You already forked this server');
  }

  const forkId = generateId();
  let serverId: string | null = null;

  // Optionally create a hosted server from the forked spec
  if (options?.createServer) {
    serverId = generateId();
    const name = options.customName || `${source.title} (fork)`;
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${userId.slice(0, 6)}`;

    await db.execute({
      sql: `INSERT INTO servers (id, user_id, name, slug, description, language, spec_snapshot, tool_count, visibility)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'private')`,
      args: [serverId, userId, name, slug, source.description, source.language, source.spec_snapshot, source.tool_count],
    });
  }

  // Record the fork
  await db.execute({
    sql: `INSERT INTO registry_forks (id, source_listing_id, forked_by_user_id, forked_server_id)
          VALUES (?, ?, ?, ?)`,
    args: [forkId, listingId, userId, serverId],
  });

  // Increment fork count on source listing
  await db.execute({
    sql: `UPDATE registry_listings SET forks_count = forks_count + 1, updated_at = datetime('now') WHERE id = ?`,
    args: [listingId],
  });

  return {
    listing: source,
    serverId,
    forkId,
  };
}

export async function getUserForks(userId: string): Promise<{ forkId: string; listingId: string; serverId: string | null; createdAt: string }[]> {
  const db = getDb();
  await initDb();

  const result = await db.execute({
    sql: `SELECT id, source_listing_id, forked_server_id, created_at
          FROM registry_forks WHERE forked_by_user_id = ? ORDER BY created_at DESC`,
    args: [userId],
  });

  return result.rows.map(r => ({
    forkId: r.id as string,
    listingId: r.source_listing_id as string,
    serverId: r.forked_server_id as string | null,
    createdAt: r.created_at as string,
  }));
}
