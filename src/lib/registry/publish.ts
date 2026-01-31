// Registry publish/unpublish functions

import { getDb, initDb, generateId } from '@/lib/db';
import type { RegistryListing, RegistryCategoryId } from './types';
import { REGISTRY_CATEGORIES } from './types';

const validCategories = new Set(REGISTRY_CATEGORIES.map(c => c.id));

export interface PublishParams {
  userId: string;
  serverId?: string;
  title: string;
  description: string;
  readme?: string;
  categories: string[];
  tags?: string[];
  apiSourceUrl?: string;
  specSnapshot: string;
  language: 'typescript' | 'python';
  toolCount: number;
  toolNames: string[];
  version?: string;
  githubRepo?: string;
}

function validatePublishParams(params: PublishParams): string | null {
  if (!params.title || params.title.length < 3 || params.title.length > 100) {
    return 'Title must be 3-100 characters';
  }
  if (!params.description || params.description.length < 10 || params.description.length > 500) {
    return 'Description must be 10-500 characters';
  }
  if (!params.categories.length || params.categories.length > 3) {
    return 'Select 1-3 categories';
  }
  for (const cat of params.categories) {
    if (!validCategories.has(cat as RegistryCategoryId)) {
      return `Invalid category: ${cat}`;
    }
  }
  if (params.tags && params.tags.length > 10) {
    return 'Maximum 10 tags';
  }
  if (params.tags) {
    for (const tag of params.tags) {
      if (tag.length > 30 || !/^[a-z0-9-]+$/.test(tag)) {
        return `Invalid tag: "${tag}". Use lowercase letters, numbers, and hyphens.`;
      }
    }
  }
  if (!params.specSnapshot) {
    return 'Spec snapshot is required';
  }
  if (params.toolCount < 1) {
    return 'Server must have at least one tool';
  }
  if (params.githubRepo && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(params.githubRepo)) {
    return 'Invalid GitHub repo URL';
  }
  return null;
}

export async function publishToRegistry(params: PublishParams): Promise<RegistryListing> {
  const error = validatePublishParams(params);
  if (error) throw new Error(error);

  const db = getDb();
  await initDb();

  const id = generateId();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO registry_listings
          (id, server_id, user_id, title, description, readme, categories, tags,
           api_source_url, spec_snapshot, language, tool_count, tool_names,
           version, github_repo, published_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      params.serverId || null,
      params.userId,
      params.title,
      params.description,
      params.readme || null,
      JSON.stringify(params.categories),
      JSON.stringify(params.tags || []),
      params.apiSourceUrl || null,
      params.specSnapshot,
      params.language,
      params.toolCount,
      JSON.stringify(params.toolNames),
      params.version || '1.0.0',
      params.githubRepo || null,
      now,
      now,
    ],
  });

  return {
    id,
    server_id: params.serverId || null,
    user_id: params.userId,
    title: params.title,
    description: params.description,
    readme: params.readme || null,
    categories: params.categories,
    tags: params.tags || [],
    api_source_url: params.apiSourceUrl || null,
    spec_snapshot: params.specSnapshot,
    language: params.language,
    tool_count: params.toolCount,
    tool_names: params.toolNames,
    stars_count: 0,
    forks_count: 0,
    installs_count: 0,
    featured: false,
    verified: false,
    status: 'published',
    version: params.version || '1.0.0',
    github_repo: params.githubRepo || null,
    published_at: now,
    updated_at: now,
  };
}

export async function unpublishFromRegistry(listingId: string, userId: string): Promise<boolean> {
  const db = getDb();
  await initDb();

  const result = await db.execute({
    sql: `UPDATE registry_listings SET status = 'unlisted', updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`,
    args: [listingId, userId],
  });

  return (result.rowsAffected || 0) > 0;
}

export async function updateRegistryListing(
  listingId: string,
  userId: string,
  updates: Partial<Pick<PublishParams, 'title' | 'description' | 'readme' | 'categories' | 'tags' | 'specSnapshot' | 'toolCount' | 'toolNames' | 'version' | 'githubRepo'>>
): Promise<boolean> {
  const db = getDb();
  await initDb();

  const sets: string[] = ["updated_at = datetime('now')"];
  const args: (string | number | null)[] = [];

  if (updates.title) { sets.push('title = ?'); args.push(updates.title); }
  if (updates.description) { sets.push('description = ?'); args.push(updates.description); }
  if (updates.readme !== undefined) { sets.push('readme = ?'); args.push(updates.readme || null); }
  if (updates.categories) { sets.push('categories = ?'); args.push(JSON.stringify(updates.categories)); }
  if (updates.tags) { sets.push('tags = ?'); args.push(JSON.stringify(updates.tags)); }
  if (updates.specSnapshot) { sets.push('spec_snapshot = ?'); args.push(updates.specSnapshot); }
  if (updates.toolCount !== undefined) { sets.push('tool_count = ?'); args.push(updates.toolCount); }
  if (updates.toolNames) { sets.push('tool_names = ?'); args.push(JSON.stringify(updates.toolNames)); }
  if (updates.version) { sets.push('version = ?'); args.push(updates.version); }
  if (updates.githubRepo !== undefined) { sets.push('github_repo = ?'); args.push(updates.githubRepo || null); }

  args.push(listingId, userId);

  const result = await db.execute({
    sql: `UPDATE registry_listings SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
    args,
  });

  return (result.rowsAffected || 0) > 0;
}
