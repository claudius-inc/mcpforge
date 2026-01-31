// GET /api/registry/[id] — get single listing
// DELETE /api/registry/[id] — unpublish listing

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRegistryListing, unpublishFromRegistry } from '@/lib/registry';
import { updateRegistryListing } from '@/lib/registry/publish';
import { getDb, initDb } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession().catch(() => null);

  const listing = await getRegistryListing(id, session?.id);
  if (!listing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Increment installs count for detail views (proxy for "interest")
  const db = getDb();
  await initDb();
  await db.execute({
    sql: `UPDATE registry_listings SET installs_count = installs_count + 1 WHERE id = ?`,
    args: [id],
  });

  return NextResponse.json(listing);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const updated = await updateRegistryListing(id, session.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Not found or not your listing' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Update failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const removed = await unpublishFromRegistry(id, session.id);
  if (!removed) {
    return NextResponse.json({ error: 'Not found or not your listing' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
