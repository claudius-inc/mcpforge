import { NextRequest, NextResponse } from 'next/server';
import { composeAPIs } from '@/lib/composer';
import type { APISource } from '@/lib/composer';
import { generateTypeScriptServer } from '@/lib/generator/typescript';
import { generatePythonServer } from '@/lib/generator/python';
import { createZipBundle } from '@/lib/output/zip-bundle';

/**
 * POST /api/compose
 * Combine multiple OpenAPI specs into a single MCP server.
 *
 * Body: {
 *   apis: [{ name: string, spec: string, prefix?: string, disabledTools?: string[] }],
 *   serverName?: string,
 *   serverDescription?: string,
 *   target?: "typescript" | "python",
 *   mode?: "preview" | "download"  // preview returns tool list, download returns ZIP
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      apis,
      serverName,
      serverDescription,
      target = 'typescript',
      mode = 'preview',
    } = body;

    // Validate
    if (!Array.isArray(apis) || apis.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty "apis" array.' },
        { status: 400 }
      );
    }

    if (apis.length > 20) {
      return NextResponse.json(
        { error: 'Too many APIs (max 20).' },
        { status: 400 }
      );
    }

    for (const api of apis) {
      if (!api.name || typeof api.name !== 'string') {
        return NextResponse.json(
          { error: 'Each API must have a "name" string.' },
          { status: 400 }
        );
      }
      if (!api.spec || typeof api.spec !== 'string') {
        return NextResponse.json(
          { error: `API "${api.name}" is missing a "spec" string.` },
          { status: 400 }
        );
      }
    }

    if (!['typescript', 'python'].includes(target)) {
      return NextResponse.json(
        { error: 'Invalid target. Must be "typescript" or "python".' },
        { status: 400 }
      );
    }

    // Compose
    const { config, errors, warnings } = composeAPIs(
      apis as APISource[],
      serverName,
      serverDescription,
    );

    // If all APIs failed, return error
    if (config.tools.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: 'All APIs failed to parse', details: errors, warnings },
        { status: 400 }
      );
    }

    // Preview mode: return tool list
    if (mode === 'preview') {
      return NextResponse.json({
        success: true,
        server: {
          name: config.name,
          version: config.version,
          description: config.description,
          toolCount: config.tools.length,
          envVars: config.envVars,
        },
        tools: config.tools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          source: t.source,
          enabled: t.enabled,
          handler: {
            method: t.handler.method,
            path: t.handler.path,
            baseUrl: t.handler.baseUrl,
          },
        })),
        errors,
        warnings,
      });
    }

    // Download mode: generate and bundle
    const files = target === 'typescript'
      ? generateTypeScriptServer(config)
      : generatePythonServer(config);

    const folderName = `mcp-${config.name}`;
    const zipBuffer = await createZipBundle(files, folderName);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`,
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (error) {
    console.error('Compose error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}
