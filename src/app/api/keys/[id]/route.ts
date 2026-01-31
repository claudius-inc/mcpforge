import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  await initDb();

  // Only delete own keys
  const result = await db.execute({
    sql: 'DELETE FROM api_keys WHERE id = ? AND user_id = ?',
    args: [params.id, session.id],
  });

  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
