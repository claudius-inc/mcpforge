import { NextRequest, NextResponse } from 'next/server';
import { parseOpenAPISpec } from '@/lib/parser';
import { mapSpecToMCPServer } from '@/lib/mapper';
import { generateTypeScriptServer } from '@/lib/generator/typescript';
import { generatePythonServer } from '@/lib/generator/python';
import { createZipBundle } from '@/lib/output/zip-bundle';
import { getSession, getMonthlyUsage, checkLimit, trackGeneration } from '@/lib/auth';

/**
 * POST /api/generate
 * Accept an OpenAPI spec and target language, return a downloadable ZIP
 * containing a complete MCP server.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { spec: rawSpec, target = 'typescript', disabledTools = [] } = body;

    // Tier enforcement (anonymous users get free limits)
    const session = await getSession();
    const userId = session?.id || null;
    const tier = session?.tier || 'free';

    if (userId) {
      const usage = await getMonthlyUsage(userId, 'generate');
      const limitCheck = checkLimit(tier, 'generationsPerMonth', usage);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { error: `Monthly generation limit reached (${limitCheck.limit}). Upgrade for more.`, upgrade: true },
          { status: 429 }
        );
      }
    }

    if (!rawSpec || typeof rawSpec !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "spec" field.' },
        { status: 400 }
      );
    }

    if (!['typescript', 'python'].includes(target)) {
      return NextResponse.json(
        { error: 'Invalid target. Must be "typescript" or "python".' },
        { status: 400 }
      );
    }

    // Parse
    const parseResult = parseOpenAPISpec(rawSpec);
    if (!parseResult.success || !parseResult.spec) {
      return NextResponse.json(
        { error: 'Failed to parse OpenAPI spec', details: parseResult.errors },
        { status: 400 }
      );
    }

    // Map to MCP
    const serverConfig = mapSpecToMCPServer(parseResult.spec);

    // Apply tool disabling
    if (Array.isArray(disabledTools)) {
      for (const tool of serverConfig.tools) {
        if (disabledTools.includes(tool.name)) {
          tool.enabled = false;
        }
      }
    }

    // Generate code
    const files = target === 'typescript'
      ? generateTypeScriptServer(serverConfig)
      : generatePythonServer(serverConfig);

    // Bundle as ZIP
    const folderName = `mcp-${serverConfig.name}`;
    const zipBuffer = await createZipBundle(files, folderName);

    // Track generation
    await trackGeneration(
      userId,
      userId ? null : req.headers.get('x-forwarded-for') || 'anon',
      'generate',
      serverConfig.name,
      serverConfig.tools.filter(t => t.enabled !== false).length,
      target
    );

    // Return ZIP (convert Buffer to Uint8Array for NextResponse compat)
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`,
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}
