import { parseOpenAPISpec } from '../parser';
import { mapSpecToMCPServer } from '../mapper';
import type { MCPServerConfig, MCPTool, EnvVar } from '../mapper/types';
import type { APISource, ComposeError } from './types';

/**
 * Compose multiple OpenAPI specs into a single MCP server config.
 *
 * Each API's tools are prefixed with its name to avoid collisions.
 * Environment variables are also prefixed per-API.
 */
export function composeAPIs(
  apis: APISource[],
  serverName?: string,
  serverDescription?: string,
): { config: MCPServerConfig; errors: ComposeError[]; warnings: string[] } {
  const errors: ComposeError[] = [];
  const warnings: string[] = [];
  const allTools: MCPTool[] = [];
  const allEnvVars: EnvVar[] = [];
  const usedToolNames = new Set<string>();
  const usedEnvVarNames = new Set<string>();
  const successfulAPIs: string[] = [];

  if (apis.length === 0) {
    errors.push({ api: '*', message: 'No APIs provided' });
    return {
      config: emptyConfig(serverName),
      errors,
      warnings,
    };
  }

  if (apis.length > 20) {
    errors.push({ api: '*', message: 'Too many APIs (max 20)' });
    return {
      config: emptyConfig(serverName),
      errors,
      warnings,
    };
  }

  // Validate unique names
  const names = new Set<string>();
  for (const api of apis) {
    const sanitized = sanitizePrefix(api.prefix || api.name);
    if (names.has(sanitized)) {
      errors.push({ api: api.name, message: `Duplicate API name "${sanitized}"` });
      return { config: emptyConfig(serverName), errors, warnings };
    }
    names.add(sanitized);
  }

  for (const api of apis) {
    const prefix = sanitizePrefix(api.prefix || api.name);

    // Parse
    const parseResult = parseOpenAPISpec(api.spec);
    if (!parseResult.success || !parseResult.spec) {
      errors.push({
        api: api.name,
        message: 'Failed to parse OpenAPI spec',
        details: parseResult.errors,
      });
      continue;
    }

    // Carry parse warnings
    for (const w of parseResult.warnings) {
      warnings.push(`[${api.name}] ${w}`);
    }

    // Map to MCP config
    const serverConfig = mapSpecToMCPServer(parseResult.spec);

    // Prefix and add tools
    for (const tool of serverConfig.tools) {
      // Apply disabling (match against sanitized name OR original operationId)
      if (api.disabledTools?.some(d =>
        d === tool.name ||
        d.toLowerCase() === tool.name ||
        d === tool.source.operationId
      )) {
        continue;
      }

      // Prefix the tool name
      const prefixedName = `${prefix}_${tool.name}`.slice(0, 64);

      if (usedToolNames.has(prefixedName)) {
        warnings.push(`[${api.name}] Skipped duplicate tool: ${prefixedName}`);
        continue;
      }
      usedToolNames.add(prefixedName);

      // Update the tool with prefixed name and tagged description
      const composedTool: MCPTool = {
        ...tool,
        name: prefixedName,
        description: `[${api.name}] ${tool.description}`,
        handler: {
          ...tool.handler,
          baseUrlEnvVar: `${prefix.toUpperCase()}_API_BASE_URL`,
          auth: tool.handler.auth.map(a => ({
            ...a,
            envVar: `${prefix.toUpperCase()}_${a.envVar}`,
          })),
        },
      };

      allTools.push(composedTool);
    }

    // Prefix and add env vars
    for (const envVar of serverConfig.envVars) {
      const prefixedName = `${prefix.toUpperCase()}_${envVar.name}`;
      if (usedEnvVarNames.has(prefixedName)) continue;
      usedEnvVarNames.add(prefixedName);

      allEnvVars.push({
        ...envVar,
        name: prefixedName,
        description: `[${api.name}] ${envVar.description}`,
      });
    }

    successfulAPIs.push(api.name);
  }

  if (successfulAPIs.length === 0 && errors.length > 0) {
    return { config: emptyConfig(serverName), errors, warnings };
  }

  const name = serverName
    ? sanitizeServerName(serverName)
    : `composed-${successfulAPIs.map(n => sanitizePrefix(n)).join('-')}`.slice(0, 50);

  const description = serverDescription
    || `Composed MCP server combining: ${successfulAPIs.join(', ')}`;

  return {
    config: {
      name,
      version: '1.0.0',
      description,
      baseUrl: '', // No single base URL for composed server
      tools: allTools,
      envVars: allEnvVars,
    },
    errors,
    warnings,
  };
}

function sanitizePrefix(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20) || 'api';
}

function sanitizeServerName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'composed-server';
}

function emptyConfig(name?: string): MCPServerConfig {
  return {
    name: name ? sanitizeServerName(name) : 'composed-server',
    version: '1.0.0',
    description: 'Composed MCP server',
    baseUrl: '',
    tools: [],
    envVars: [],
  };
}
