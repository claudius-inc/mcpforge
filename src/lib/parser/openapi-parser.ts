import yaml from 'js-yaml';
import type {
  ParsedSpec, ParsedEndpoint, ParsedParameter, ParsedRequestBody,
  ParsedResponse, SecurityScheme, SchemaObject, HttpMethod,
  ServerInfo, SecurityRequirement, ParseResult, ParseError,
} from './types';

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

/**
 * Parse an OpenAPI 3.0/3.1 spec (JSON or YAML string) into our internal format.
 * Resolves $ref pointers, extracts endpoints, schemas, and security schemes.
 */
export function parseOpenAPISpec(input: string): ParseResult {
  const errors: ParseError[] = [];
  const warnings: string[] = [];

  // 1. Parse raw input
  let raw: Record<string, unknown>;
  try {
    raw = typeof input === 'string'
      ? (input.trim().startsWith('{') ? JSON.parse(input) : yaml.load(input) as Record<string, unknown>)
      : input;
  } catch (e) {
    return { success: false, errors: [{ path: '', message: `Failed to parse input: ${(e as Error).message}` }], warnings };
  }

  // 2. Validate OpenAPI version
  const openapi = (raw.openapi as string) || '';
  if (!openapi.startsWith('3.')) {
    errors.push({ path: 'openapi', message: `Unsupported OpenAPI version: "${openapi}". MCPForge requires OpenAPI 3.0 or 3.1.` });
    return { success: false, errors, warnings };
  }

  // 3. Build ref resolver
  const resolve = buildRefResolver(raw);

  // 4. Extract info
  const info = (raw.info || {}) as Record<string, unknown>;
  const title = (info.title as string) || 'Untitled API';
  const description = (info.description as string) || '';
  const version = (info.version as string) || '1.0.0';

  // 5. Extract servers
  const servers = extractServers(raw);
  const baseUrl = servers[0]?.url || 'https://api.example.com';

  // 6. Extract security schemes
  const components = (raw.components || {}) as Record<string, unknown>;
  const rawSecSchemes = (components.securitySchemes || {}) as Record<string, unknown>;
  const securitySchemes = extractSecuritySchemes(rawSecSchemes, resolve);

  // 7. Extract schemas
  const rawSchemas = (components.schemas || {}) as Record<string, unknown>;
  const schemas: Record<string, SchemaObject> = {};
  for (const [name, schema] of Object.entries(rawSchemas)) {
    schemas[name] = resolveSchema(schema as SchemaObject, resolve);
  }

  // 8. Extract endpoints
  const paths = (raw.paths || {}) as Record<string, unknown>;
  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const resolved = resolve(pathItem) as Record<string, unknown>;

    // Path-level parameters
    const pathParams = extractParameters(
      (resolved.parameters || []) as unknown[], resolve
    );

    for (const method of HTTP_METHODS) {
      const operation = resolved[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const endpoint = extractEndpoint(path, method, operation, pathParams, resolve, securitySchemes, raw);
      endpoints.push(endpoint);
    }
  }

  if (endpoints.length === 0) {
    warnings.push('No endpoints found in the spec. The generated MCP server will have no tools.');
  }

  const spec: ParsedSpec = {
    title,
    description,
    version,
    baseUrl,
    servers,
    endpoints,
    securitySchemes,
    schemas,
  };

  return { success: true, spec, errors, warnings };
}

// ─── Ref Resolution ──────────────────────────────────────────────

function buildRefResolver(root: Record<string, unknown>): (obj: unknown) => unknown {
  const cache = new Map<string, unknown>();

  function resolve(obj: unknown, depth = 0): unknown {
    if (depth > 50) return obj; // prevent infinite loops
    if (!obj || typeof obj !== 'object') return obj;

    const rec = obj as Record<string, unknown>;
    if (typeof rec.$ref === 'string') {
      const ref = rec.$ref;
      if (cache.has(ref)) return cache.get(ref);

      const resolved = followRef(root, ref);
      if (resolved !== undefined) {
        cache.set(ref, resolved); // set early to handle circular
        const deep = resolve(resolved, depth + 1);
        cache.set(ref, deep);
        return deep;
      }
      return obj;
    }

    // Resolve nested objects
    if (Array.isArray(obj)) {
      return obj.map(item => resolve(item, depth + 1));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rec)) {
      result[key] = resolve(value, depth + 1);
    }
    return result;
  }

  return resolve;
}

function followRef(root: Record<string, unknown>, ref: string): unknown {
  if (!ref.startsWith('#/')) return undefined;
  const parts = ref.slice(2).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current: unknown = root;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ─── Extraction Helpers ──────────────────────────────────────────

function extractServers(raw: Record<string, unknown>): ServerInfo[] {
  const servers = (raw.servers || []) as Array<Record<string, unknown>>;
  return servers.map(s => ({
    url: (s.url as string) || '',
    description: s.description as string | undefined,
  }));
}

function extractSecuritySchemes(
  raw: Record<string, unknown>,
  resolve: (obj: unknown) => unknown
): SecurityScheme[] {
  const schemes: SecurityScheme[] = [];
  for (const [name, def] of Object.entries(raw)) {
    const resolved = resolve(def) as Record<string, unknown>;
    const type = resolved.type as string;

    const scheme: SecurityScheme = {
      name,
      type: type as SecurityScheme['type'],
      description: resolved.description as string | undefined,
    };

    if (type === 'http') {
      scheme.scheme = (resolved.scheme as string)?.toLowerCase();
      scheme.bearerFormat = resolved.bearerFormat as string | undefined;
    } else if (type === 'apiKey') {
      scheme.in = resolved.in as 'query' | 'header' | 'cookie';
      scheme.paramName = resolved.name as string;
    } else if (type === 'oauth2') {
      scheme.flows = resolved.flows as SecurityScheme['flows'];
    }

    schemes.push(scheme);
  }
  return schemes;
}

function extractParameters(
  raw: unknown[],
  resolve: (obj: unknown) => unknown
): ParsedParameter[] {
  return raw.map(p => {
    const resolved = resolve(p) as Record<string, unknown>;
    return {
      name: (resolved.name as string) || '',
      in: (resolved.in as ParsedParameter['in']) || 'query',
      description: resolved.description as string | undefined,
      required: resolved.in === 'path' ? true : (resolved.required as boolean) || false,
      schema: resolveSchema((resolved.schema || { type: 'string' }) as SchemaObject, resolve),
      example: resolved.example,
    };
  });
}

function extractEndpoint(
  path: string,
  method: HttpMethod,
  operation: Record<string, unknown>,
  pathParams: ParsedParameter[],
  resolve: (obj: unknown) => unknown,
  securitySchemes: SecurityScheme[],
  root: Record<string, unknown>,
): ParsedEndpoint {
  // Operation-level parameters (merged with path params)
  const opParams = extractParameters(
    (operation.parameters || []) as unknown[], resolve
  );

  // Merge: operation params override path params by name+in
  const paramMap = new Map<string, ParsedParameter>();
  for (const p of pathParams) paramMap.set(`${p.in}:${p.name}`, p);
  for (const p of opParams) paramMap.set(`${p.in}:${p.name}`, p);
  const parameters = Array.from(paramMap.values());

  // Request body
  let requestBody: ParsedRequestBody | undefined;
  if (operation.requestBody) {
    const rb = resolve(operation.requestBody) as Record<string, unknown>;
    const content = (rb.content || {}) as Record<string, unknown>;
    const contentType = Object.keys(content)[0] || 'application/json';
    const mediaType = (content[contentType] || {}) as Record<string, unknown>;

    requestBody = {
      description: rb.description as string | undefined,
      required: (rb.required as boolean) || false,
      contentType,
      schema: resolveSchema((mediaType.schema || {}) as SchemaObject, resolve),
    };
  }

  // Responses
  const rawResponses = (operation.responses || {}) as Record<string, unknown>;
  const responses: Record<string, ParsedResponse> = {};
  for (const [code, resp] of Object.entries(rawResponses)) {
    const resolved = resolve(resp) as Record<string, unknown>;
    const content = (resolved.content || {}) as Record<string, unknown>;
    const contentType = Object.keys(content)[0];
    let schema: SchemaObject | undefined;
    if (contentType) {
      const mediaType = (content[contentType] || {}) as Record<string, unknown>;
      schema = resolveSchema((mediaType.schema || {}) as SchemaObject, resolve);
    }

    responses[code] = {
      statusCode: code,
      description: (resolved.description as string) || '',
      contentType,
      schema,
    };
  }

  // Security requirements
  const opSecurity = (operation.security ?? root.security ?? []) as Array<Record<string, string[]>>;
  const security: SecurityRequirement[] = opSecurity.map(req => {
    const schemeName = Object.keys(req)[0] || '';
    return { schemeName, scopes: req[schemeName] || [] };
  });

  return {
    path,
    method,
    operationId: operation.operationId as string | undefined,
    summary: operation.summary as string | undefined,
    description: operation.description as string | undefined,
    tags: (operation.tags as string[]) || [],
    parameters,
    requestBody,
    responses,
    security,
    deprecated: (operation.deprecated as boolean) || false,
  };
}

function resolveSchema(schema: SchemaObject, resolve: (obj: unknown) => unknown): SchemaObject {
  if (!schema) return { type: 'object' };
  const resolved = resolve(schema) as SchemaObject;

  // Handle allOf composition
  if (resolved.allOf && Array.isArray(resolved.allOf)) {
    const merged: SchemaObject = { type: 'object', properties: {}, required: [] };
    for (const sub of resolved.allOf) {
      const r = resolveSchema(sub, resolve);
      if (r.properties) {
        merged.properties = { ...merged.properties, ...r.properties };
      }
      if (r.required) {
        merged.required = [...(merged.required || []), ...r.required];
      }
    }
    return merged;
  }

  return resolved;
}

export { resolveSchema, buildRefResolver };
