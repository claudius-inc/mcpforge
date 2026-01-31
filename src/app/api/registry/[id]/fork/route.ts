// POST /api/registry/[id]/fork — fork a registry listing

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { forkListing } from '@/lib/registry';
import { hasFeature } from '@/lib/auth/tiers';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const createServer = body.createServer && hasFeature(session.tier, 'hostedDeploy');

    const result = await forkListing(id, session.id, {
      createServer,
      customName: body.customName,
    });

    return NextResponse.json({
      forkId: result.forkId,
      serverId: result.serverId,
      sourceTitle: result.listing.title,
      specSnapshot: result.listing.spec_snapshot,
    }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Fork failed';
    const status = message.includes('already forked') || message.includes('not found') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
