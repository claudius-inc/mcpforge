// Registry star/unstar functions

import { getDb, initDb } from '@/lib/db';

export async function starListing(userId: string, listingId: string): Promise<boolean> {
  const db = getDb();
  await initDb();

  try {
    await db.execute({
      sql: `INSERT INTO registry_stars (user_id, listing_id) VALUES (?, ?)`,
      args: [userId, listingId],
    });
    await db.execute({
      sql: `UPDATE registry_listings SET stars_count = stars_count + 1, updated_at = datetime('now') WHERE id = ?`,
      args: [listingId],
    });
    return true;
  } catch (e: unknown) {
    // Already starred (unique constraint violation)
    if (e instanceof Error && e.message?.includes('UNIQUE')) return false;
    throw e;
  }
}

export async function unstarListing(userId: string, listingId: string): Promise<boolean> {
  const db = getDb();
  await initDb();

  const result = await db.execute({
    sql: `DELETE FROM registry_stars WHERE user_id = ? AND listing_id = ?`,
    args: [userId, listingId],
  });

  if ((result.rowsAffected || 0) > 0) {
    await db.execute({
      sql: `UPDATE registry_listings SET stars_count = MAX(0, stars_count - 1), updated_at = datetime('now') WHERE id = ?`,
      args: [listingId],
    });
    return true;
  }
  return false;
}

export async function getUserStars(userId: string): Promise<string[]> {
  const db = getDb();
  await initDb();

  const result = await db.execute({
    sql: `SELECT listing_id FROM registry_stars WHERE user_id = ? ORDER BY created_at DESC`,
    args: [userId],
  });

  return result.rows.map(r => r.listing_id as string);
}
