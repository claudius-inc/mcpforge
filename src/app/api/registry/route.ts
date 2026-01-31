// GET /api/registry — browse/search registry
// POST /api/registry — publish to registry

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchRegistry, publishToRegistry } from '@/lib/registry';
import type { RegistrySearchParams } from '@/lib/registry';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const session = await getSession().catch(() => null);

  const params: RegistrySearchParams = {
    query: searchParams.get('q') || undefined,
    category: searchParams.get('category') || undefined,
    tag: searchParams.get('tag') || undefined,
    language: (searchParams.get('language') as 'typescript' | 'python') || undefined,
    sort: (searchParams.get('sort') as RegistrySearchParams['sort']) || undefined,
    featured: searchParams.get('featured') === 'true',
    page: Number(searchParams.get('page')) || 1,
    limit: Number(searchParams.get('limit')) || 20,
  };

  // Clean undefined featured
  if (!searchParams.has('featured')) delete params.featured;

  try {
    const result = await searchRegistry(params, session?.id);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Search failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await req.json();

    const listing = await publishToRegistry({
      userId: session.id,
      serverId: body.serverId || undefined,
      title: body.title,
      description: body.description,
      readme: body.readme,
      categories: body.categories || [],
      tags: body.tags || [],
      apiSourceUrl: body.apiSourceUrl,
      specSnapshot: body.specSnapshot,
      language: body.language || 'typescript',
      toolCount: body.toolCount || 0,
      toolNames: body.toolNames || [],
      version: body.version,
      githubRepo: body.githubRepo,
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Publish failed';
    const status = message.includes('must be') || message.includes('Select') || message.includes('Invalid') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
