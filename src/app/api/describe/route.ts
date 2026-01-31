import { NextRequest, NextResponse } from 'next/server';
import { generateSpecFromDescription, validateDescription } from '@/lib/ai';
import { getSession, getMonthlyUsage, checkLimit, trackGeneration } from '@/lib/auth';

/**
 * POST /api/describe
 * Accept a plain English description and return an AI-generated OpenAPI spec.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description } = body;

    // Tier enforcement
    const session = await getSession();
    const userId = session?.id || null;
    const tier = session?.tier || 'free';

    if (userId) {
      const usage = await getMonthlyUsage(userId, 'describe');
      const limitCheck = checkLimit(tier, 'aiDescribesPerMonth', usage);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { error: `Monthly AI describe limit reached (${limitCheck.limit}). Upgrade for more.`, upgrade: true },
          { status: 429 }
        );
      }
    }

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "description" field. Provide a plain English description of the API.' },
        { status: 400 }
      );
    }

    // Validate description
    const validation = validateDescription(description);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Generate spec from description
    const result = await generateSpecFromDescription({ description });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error?.includes('API key') ? 503 : 422 }
      );
    }

    // Track usage
    if (userId) {
      await trackGeneration(userId, null, 'describe', description.slice(0, 100), 0, 'openapi');
    }

    return NextResponse.json({
      success: true,
      spec: result.spec,
      model: result.model,
      usage: result.usage,
    });
  } catch (error) {
    console.error('Describe error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}
