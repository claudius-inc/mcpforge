import type { MCPServerConfig, MCPTool, ToolHandler, EnvVar } from '../mapper/types';

/**
 * Generate a complete TypeScript MCP server from the server config.
 * Returns a map of filename → content.
 */
export function generateTypeScriptServer(config: MCPServerConfig): Record<string, string> {
  const files: Record<string, string> = {};

  files['package.json'] = generatePackageJson(config);
  files['tsconfig.json'] = generateTsConfig();
  files['src/index.ts'] = generateServerEntry(config);
  files['src/tools.ts'] = generateToolDefinitions(config);
  files['src/http-client.ts'] = generateHttpClient(config);
  files['.env.example'] = generateEnvExample(config);
  files['Dockerfile'] = generateDockerfile(config);
  files['README.md'] = generateReadme(config);

  return files;
}

// ─── Package.json ────────────────────────────────────────────────

function generatePackageJson(config: MCPServerConfig): string {
  const pkg = {
    name: `mcp-${config.name}`,
    version: config.version,
    description: config.description,
    type: 'module',
    main: 'dist/index.js',
    scripts: {
      build: 'tsc',
      start: 'node dist/index.js',
      dev: 'tsx src/index.ts',
    },
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.0.0',
    },
    devDependencies: {
      typescript: '^5.7.0',
      '@types/node': '^22.0.0',
      tsx: '^4.19.0',
    },
  };
  return JSON.stringify(pkg, null, 2);
}

function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
    },
    include: ['src/**/*'],
  };
  return JSON.stringify(config, null, 2);
}

// ─── Server Entry ────────────────────────────────────────────────

function generateServerEntry(config: MCPServerConfig): string {
  return `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';

const server = new McpServer({
  name: '${escapeStr(config.name)}',
  version: '${escapeStr(config.version)}',
});

// Register all API tools
registerTools(server);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('${escapeStr(config.name)} MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
`;
}

// ─── Tool Definitions ────────────────────────────────────────────

function generateToolDefinitions(config: MCPServerConfig): string {
  const imports = `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest } from './http-client.js';
`;

  const registerFn = `
export function registerTools(server: McpServer) {
${config.tools.filter(t => t.enabled).map(t => generateToolRegistration(t)).join('\n\n')}
}
`;

  return imports + registerFn;
}

function generateToolRegistration(tool: MCPTool): string {
  const zodSchema = generateZodSchema(tool.inputSchema);
  const handlerBody = generateHandlerBody(tool);

  return `  // ${tool.source.method.toUpperCase()} ${tool.source.path}
  server.tool(
    '${escapeStr(tool.name)}',
    '${escapeStr(tool.description.slice(0, 200))}',
    {
${zodSchema}
    },
    async (params) => {
${handlerBody}
    }
  );`;
}

function generateZodSchema(schema: { properties: Record<string, unknown>; required: string[] }): string {
  const lines: string[] = [];
  for (const [name, prop] of Object.entries(schema.properties)) {
    const p = prop as { type: string; description?: string; enum?: unknown[]; items?: { type: string } };
    let zodType = mapToZodType(p);
    if (p.description) {
      zodType += `.describe('${escapeStr(p.description.slice(0, 100))}')`;
    }
    if (!schema.required.includes(name)) {
      zodType += '.optional()';
    }
    lines.push(`      ${name}: ${zodType},`);
  }
  return lines.join('\n');
}

function mapToZodType(prop: { type: string; enum?: unknown[]; items?: { type: string } }): string {
  if (prop.enum) {
    const values = prop.enum.map(v => typeof v === 'string' ? `'${escapeStr(v)}'` : String(v));
    return `z.enum([${values.join(', ')}])`;
  }
  switch (prop.type) {
    case 'string': return 'z.string()';
    case 'number': return 'z.number()';
    case 'boolean': return 'z.boolean()';
    case 'array':
      if (prop.items) return `z.array(${mapToZodType(prop.items as { type: string })})`;
      return 'z.array(z.unknown())';
    case 'object': return 'z.object({}).passthrough()';
    default: return 'z.string()';
  }
}

function generateHandlerBody(tool: MCPTool): string {
  const h = tool.handler;
  const lines: string[] = [];

  // Build URL with path params
  let urlExpr = `\`\${baseUrl}${h.path}\``;
  if (h.pathParams.length > 0) {
    urlExpr = `\`\${baseUrl}${h.path.replace(
      /\{([^}]+)\}/g,
      (_, name) => `\${params.${name}}`
    )}\``;
  }

  lines.push(`      const baseUrl = process.env.API_BASE_URL || '${escapeStr(h.baseUrl)}';`);
  lines.push(`      const url = ${urlExpr};`);

  // Query params
  if (h.queryParams.length > 0) {
    lines.push(`      const queryParams = new URLSearchParams();`);
    for (const qp of h.queryParams) {
      lines.push(`      if (params.${qp} !== undefined) queryParams.set('${escapeStr(qp)}', String(params.${qp}));`);
    }
    lines.push(`      const fullUrl = queryParams.toString() ? \`\${url}?\${queryParams}\` : url;`);
  } else {
    lines.push(`      const fullUrl = url;`);
  }

  // Body
  let bodyExpr = 'undefined';
  if (h.bodyParam === '__body_object__') {
    // Reconstruct body from flat params (exclude path/query/header params)
    const exclude = [...h.pathParams, ...h.queryParams, ...h.headerParams];
    lines.push(`      const body = Object.fromEntries(`);
    lines.push(`        Object.entries(params).filter(([k]) => ![${exclude.map(e => `'${e}'`).join(', ')}].includes(k) && params[k as keyof typeof params] !== undefined)`);
    lines.push(`      );`);
    bodyExpr = 'body';
  } else if (h.bodyParam) {
    bodyExpr = `params.${h.bodyParam}`;
  }

  // Headers for auth
  const headers: string[] = [];
  for (const auth of h.auth) {
    if (auth.scheme.type === 'http' && auth.scheme.scheme === 'bearer') {
      headers.push(`        'Authorization': \`Bearer \${process.env.${auth.envVar}}\``);
    } else if (auth.scheme.type === 'apiKey' && auth.scheme.in === 'header') {
      headers.push(`        '${escapeStr(auth.scheme.paramName || 'X-API-Key')}': process.env.${auth.envVar} || ''`);
    }
  }

  // Custom header params
  for (const hp of h.headerParams) {
    const origName = hp.replace(/^header_/, '').replace(/_/g, '-');
    headers.push(`        ...(params.${hp} !== undefined ? { '${origName}': String(params.${hp}) } : {})`);
  }

  lines.push(`      const result = await apiRequest({`);
  lines.push(`        method: '${h.method}',`);
  lines.push(`        url: fullUrl,`);
  if (bodyExpr !== 'undefined') {
    lines.push(`        body: ${bodyExpr},`);
  }
  if (headers.length > 0) {
    lines.push(`        headers: {`);
    lines.push(headers.join(',\n'));
    lines.push(`        },`);
  }
  lines.push(`      });`);
  lines.push('');
  lines.push(`      return {`);
  lines.push(`        content: [{`);
  lines.push(`          type: 'text' as const,`);
  lines.push(`          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),`);
  lines.push(`        }],`);
  lines.push(`      };`);

  return lines.join('\n');
}

// ─── HTTP Client ─────────────────────────────────────────────────

function generateHttpClient(config: MCPServerConfig): string {
  return `interface RequestOptions {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest(options: RequestOptions): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  const response = await fetch(options.url, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(\`API request failed: \${response.status} \${response.statusText} - \${errorText}\`);
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}
`;
}

// ─── Env Example ─────────────────────────────────────────────────

function generateEnvExample(config: MCPServerConfig): string {
  const lines = [
    `# ${config.name} MCP Server - Environment Variables`,
    `# Copy this to .env and fill in your values`,
    '',
  ];

  for (const envVar of config.envVars) {
    lines.push(`# ${envVar.description}`);
    lines.push(`${envVar.name}=${envVar.example || ''}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Dockerfile ──────────────────────────────────────────────────

function generateDockerfile(config: MCPServerConfig): string {
  return `FROM node:22-slim AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
`;
}

// ─── README ──────────────────────────────────────────────────────

function generateReadme(config: MCPServerConfig): string {
  const toolList = config.tools
    .filter(t => t.enabled)
    .map(t => `- **${t.name}** — ${t.description}`)
    .join('\n');

  const envVarList = config.envVars
    .map(v => `- \`${v.name}\` — ${v.description}${v.required ? ' (required)' : ''}`)
    .join('\n');

  return `# ${config.name} MCP Server

${config.description}

> Generated by [MCPForge](https://mcpforge.dev)

## Quick Start

\`\`\`bash
npm install
cp .env.example .env
# Edit .env with your API credentials
npm run dev
\`\`\`

## Tools

${toolList}

## Environment Variables

${envVarList}

## Usage with Claude Desktop

Add to your \`claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "${config.name}": {
      "command": "node",
      "args": ["${`dist/index.js`}"],
      "env": {
${config.envVars.map(v => `        "${v.name}": "your-value-here"`).join(',\n')}
      }
    }
  }
}
\`\`\`

## Build

\`\`\`bash
npm run build
npm start
\`\`\`

## Docker

\`\`\`bash
docker build -t mcp-${config.name} .
docker run -it --env-file .env mcp-${config.name}
\`\`\`
`;
}

// ─── Utilities ───────────────────────────────────────────────────

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

export { escapeStr };
