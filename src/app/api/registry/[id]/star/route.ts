// POST /api/registry/[id]/star — star a listing
// DELETE /api/registry/[id]/star — unstar a listing

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { starListing, unstarListing } from '@/lib/registry';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const starred = await starListing(session.id, id);
  return NextResponse.json({ starred, already: !starred });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const unstarred = await unstarListing(session.id, id);
  return NextResponse.json({ unstarred });
}
