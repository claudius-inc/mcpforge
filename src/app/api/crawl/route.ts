import { NextRequest, NextResponse } from 'next/server';
import { crawlDocsToSpec, validateUrl } from '@/lib/crawler';

/**
 * POST /api/crawl
 * Accept a documentation URL, crawl it, and return an AI-generated OpenAPI spec
 * extracted from the page content.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, additionalContext } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "url" field. Provide a documentation URL to crawl.' },
        { status: 400 }
      );
    }

    // Validate URL
    const validation = validateUrl(url.trim());
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    if (additionalContext && typeof additionalContext !== 'string') {
      return NextResponse.json(
        { error: '"additionalContext" must be a string.' },
        { status: 400 }
      );
    }

    if (additionalContext && additionalContext.length > 2000) {
      return NextResponse.json(
        { error: 'Additional context too long (max 2000 characters).' },
        { status: 400 }
      );
    }

    // Crawl and generate
    const result = await crawlDocsToSpec({
      url: url.trim(),
      additionalContext: additionalContext?.trim(),
    });

    if (!result.success) {
      const status = result.error?.includes('API key') ? 503
        : result.error?.includes('private') || result.error?.includes('blocked') ? 403
        : 422;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      spec: result.spec,
      model: result.model,
      pageTitle: result.pageTitle,
      extractedLength: result.extractedLength,
      usage: result.usage,
    });
  } catch (error) {
    console.error('Crawl error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}
