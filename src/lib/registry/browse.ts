// Registry browse/search functions

import { getDb, initDb } from '@/lib/db';
import type { RegistryListing, RegistrySearchParams, RegistrySearchResult } from './types';
import { REGISTRY_CATEGORIES } from './types';

function rowToListing(row: Record<string, unknown>): RegistryListing {
  return {
    id: row.id as string,
    server_id: row.server_id as string | null,
    user_id: row.user_id as string,
    title: row.title as string,
    description: row.description as string,
    readme: row.readme as string | null,
    categories: JSON.parse((row.categories as string) || '[]'),
    tags: JSON.parse((row.tags as string) || '[]'),
    api_source_url: row.api_source_url as string | null,
    spec_snapshot: row.spec_snapshot as string,
    language: row.language as string,
    tool_count: row.tool_count as number,
    tool_names: JSON.parse((row.tool_names as string) || '[]'),
    stars_count: row.stars_count as number,
    forks_count: row.forks_count as number,
    installs_count: row.installs_count as number,
    featured: Boolean(row.featured),
    verified: Boolean(row.verified),
    status: row.status as RegistryListing['status'],
    version: row.version as string,
    github_repo: row.github_repo as string | null,
    published_at: row.published_at as string,
    updated_at: row.updated_at as string,
    author_username: row.username as string | undefined,
    author_avatar_url: row.avatar_url as string | undefined,
    user_starred: row.user_starred !== undefined ? Boolean(row.user_starred) : undefined,
  };
}

export async function searchRegistry(
  params: RegistrySearchParams,
  currentUserId?: string
): Promise<RegistrySearchResult> {
  const db = getDb();
  await initDb();

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = ["r.status = 'published'"];
  const args: (string | number)[] = [];

  if (params.query) {
    conditions.push("(r.title LIKE ? OR r.description LIKE ? OR r.tags LIKE ?)");
    const q = `%${params.query}%`;
    args.push(q, q, q);
  }

  if (params.category) {
    conditions.push("r.categories LIKE ?");
    args.push(`%"${params.category}"%`);
  }

  if (params.tag) {
    conditions.push("r.tags LIKE ?");
    args.push(`%"${params.tag}"%`);
  }

  if (params.language) {
    conditions.push("r.language = ?");
    args.push(params.language);
  }

  if (params.featured) {
    conditions.push("r.featured = 1");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const orderMap: Record<string, string> = {
    popular: 'r.installs_count DESC, r.stars_count DESC',
    newest: 'r.published_at DESC',
    stars: 'r.stars_count DESC',
    name: 'r.title ASC',
  };
  const orderBy = orderMap[params.sort || 'popular'] || orderMap.popular;

  // Count total
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM registry_listings r ${where}`,
    args,
  });
  const total = (countResult.rows[0]?.cnt as number) || 0;

  // Star join for current user
  const starJoin = currentUserId
    ? `LEFT JOIN registry_stars s ON s.listing_id = r.id AND s.user_id = ?`
    : '';
  const starSelect = currentUserId ? ', s.user_id as user_starred' : '';

  const queryArgs = currentUserId ? [currentUserId, ...args] : [...args];
  queryArgs.push(limit, offset);

  const result = await db.execute({
    sql: `SELECT r.*, u.username, u.avatar_url${starSelect}
          FROM registry_listings r
          LEFT JOIN users u ON u.id = r.user_id
          ${starJoin}
          ${where}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?`,
    args: queryArgs,
  });

  return {
    listings: result.rows.map(row => rowToListing(row as Record<string, unknown>)),
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getRegistryListing(
  listingId: string,
  currentUserId?: string
): Promise<RegistryListing | null> {
  const db = getDb();
  await initDb();

  const starJoin = currentUserId
    ? `LEFT JOIN registry_stars s ON s.listing_id = r.id AND s.user_id = ?`
    : '';
  const starSelect = currentUserId ? ', s.user_id as user_starred' : '';
  const args: string[] = currentUserId ? [currentUserId, listingId] : [listingId];

  const result = await db.execute({
    sql: `SELECT r.*, u.username, u.avatar_url${starSelect}
          FROM registry_listings r
          LEFT JOIN users u ON u.id = r.user_id
          ${starJoin}
          WHERE r.id = ?`,
    args,
  });

  if (result.rows.length === 0) return null;
  return rowToListing(result.rows[0] as Record<string, unknown>);
}

export async function getFeaturedListings(limit = 6): Promise<RegistryListing[]> {
  const db = getDb();
  await initDb();

  const result = await db.execute({
    sql: `SELECT r.*, u.username, u.avatar_url
          FROM registry_listings r
          LEFT JOIN users u ON u.id = r.user_id
          WHERE r.status = 'published' AND r.featured = 1
          ORDER BY r.stars_count DESC
          LIMIT ?`,
    args: [limit],
  });

  return result.rows.map(row => rowToListing(row as Record<string, unknown>));
}

export async function getRegistryCategories(): Promise<{ id: string; name: string; emoji: string; count: number }[]> {
  const db = getDb();
  await initDb();

  const result = await db.execute({
    sql: `SELECT categories FROM registry_listings WHERE status = 'published'`,
    args: [],
  });

  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    const cats: string[] = JSON.parse((row.categories as string) || '[]');
    for (const cat of cats) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }

  return REGISTRY_CATEGORIES.map(c => ({
    ...c,
    count: counts[c.id] || 0,
  })).filter(c => c.count > 0);
}
