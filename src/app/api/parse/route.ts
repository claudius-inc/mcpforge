import { NextRequest, NextResponse } from 'next/server';
import { parseOpenAPISpec } from '@/lib/parser';
import { mapSpecToMCPServer } from '@/lib/mapper';

/**
 * POST /api/parse
 * Accept an OpenAPI spec (JSON/YAML string) and return parsed MCP tool definitions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { spec: rawSpec } = body;

    if (!rawSpec || typeof rawSpec !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "spec" field. Provide an OpenAPI 3.x spec as a JSON or YAML string.' },
        { status: 400 }
      );
    }

    // Parse the OpenAPI spec
    const parseResult = parseOpenAPISpec(rawSpec);

    if (!parseResult.success || !parseResult.spec) {
      return NextResponse.json(
        { error: 'Failed to parse OpenAPI spec', details: parseResult.errors },
        { status: 400 }
      );
    }

    // Map to MCP tools
    const serverConfig = mapSpecToMCPServer(parseResult.spec);

    return NextResponse.json({
      success: true,
      server: {
        name: serverConfig.name,
        version: serverConfig.version,
        description: serverConfig.description,
        baseUrl: serverConfig.baseUrl,
        toolCount: serverConfig.tools.length,
        envVars: serverConfig.envVars,
      },
      tools: serverConfig.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        source: t.source,
        enabled: t.enabled,
        handler: {
          method: t.handler.method,
          path: t.handler.path,
          baseUrl: t.handler.baseUrl,
          contentType: t.handler.contentType,
          pathParams: t.handler.pathParams,
          queryParams: t.handler.queryParams,
          headerParams: t.handler.headerParams,
          bodyParam: t.handler.bodyParam,
          auth: t.handler.auth.map(a => ({
            scheme: {
              type: a.scheme.type,
              scheme: a.scheme.scheme,
              paramName: a.scheme.paramName,
              in: a.scheme.in,
              name: a.scheme.name,
            },
            envVar: a.envVar,
          })),
        },
      })),
      warnings: parseResult.warnings,
    });
  } catch (error) {
    console.error('Parse error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}
