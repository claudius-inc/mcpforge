import type { ParsedSpec, ParsedEndpoint, SchemaObject, SecurityScheme, SecurityRequirement } from '../parser/types';
import type { MCPTool, MCPInputSchema, MCPProperty, ToolHandler, ToolAuth, MCPServerConfig, EnvVar } from './types';

/**
 * Map a parsed OpenAPI spec to MCP server configuration.
 * Each endpoint becomes an MCP tool with typed inputs and an HTTP handler.
 */
export function mapSpecToMCPServer(spec: ParsedSpec): MCPServerConfig {
  const tools: MCPTool[] = [];
  const envVarMap = new Map<string, EnvVar>();

  // Always need the base URL as env var
  envVarMap.set('API_BASE_URL', {
    name: 'API_BASE_URL',
    description: `Base URL for the ${spec.title} API`,
    required: true,
    example: spec.baseUrl,
  });

  for (const endpoint of spec.endpoints) {
    if (endpoint.deprecated) continue;

    const tool = mapEndpointToTool(endpoint, spec);
    tools.push(tool);

    // Collect env vars from auth
    for (const auth of tool.handler.auth) {
      if (!envVarMap.has(auth.envVar)) {
        envVarMap.set(auth.envVar, {
          name: auth.envVar,
          description: describeAuthEnvVar(auth.scheme),
          required: true,
        });
      }
    }
  }

  return {
    name: sanitizeServerName(spec.title),
    version: spec.version,
    description: spec.description || `MCP server for ${spec.title}`,
    baseUrl: spec.baseUrl,
    tools,
    envVars: Array.from(envVarMap.values()),
  };
}

function mapEndpointToTool(endpoint: ParsedEndpoint, spec: ParsedSpec): MCPTool {
  const name = generateToolName(endpoint);
  const description = generateToolDescription(endpoint);
  const { inputSchema, pathParams, queryParams, headerParams, bodyParam } = buildInputSchema(endpoint);
  const auth = mapAuth(endpoint.security, spec.securitySchemes);

  const handler: ToolHandler = {
    method: endpoint.method.toUpperCase(),
    path: endpoint.path,
    baseUrl: spec.baseUrl,
    contentType: endpoint.requestBody?.contentType || 'application/json',
    pathParams,
    queryParams,
    headerParams,
    bodyParam,
    auth,
  };

  return {
    name,
    description,
    inputSchema,
    handler,
    source: {
      path: endpoint.path,
      method: endpoint.method,
      operationId: endpoint.operationId,
    },
    enabled: true,
  };
}

// ─── Tool Name Generation ────────────────────────────────────────

function generateToolName(endpoint: ParsedEndpoint): string {
  // Prefer operationId if available
  if (endpoint.operationId) {
    return sanitizeToolName(endpoint.operationId);
  }

  // Generate from method + path
  const parts = endpoint.path
    .split('/')
    .filter(Boolean)
    .map(part => {
      if (part.startsWith('{') && part.endsWith('}')) {
        return 'by_' + part.slice(1, -1);
      }
      return part;
    });

  const prefix = methodToVerb(endpoint.method);
  return sanitizeToolName(`${prefix}_${parts.join('_')}`);
}

function methodToVerb(method: string): string {
  const map: Record<string, string> = {
    get: 'get',
    post: 'create',
    put: 'update',
    patch: 'patch',
    delete: 'delete',
    head: 'check',
    options: 'options',
  };
  return map[method] || method;
}

function sanitizeToolName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
    .slice(0, 64);
}

function sanitizeServerName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'api-server';
}

// ─── Description Generation ──────────────────────────────────────

function generateToolDescription(endpoint: ParsedEndpoint): string {
  if (endpoint.summary && endpoint.description) {
    return `${endpoint.summary}. ${endpoint.description}`;
  }
  if (endpoint.summary) return endpoint.summary;
  if (endpoint.description) return endpoint.description;

  // Auto-generate from method + path
  const resource = endpoint.path.split('/').filter(p => !p.startsWith('{')).pop() || 'resource';
  const action = methodToHumanVerb(endpoint.method);
  return `${action} ${resource}`;
}

function methodToHumanVerb(method: string): string {
  const map: Record<string, string> = {
    get: 'Retrieve',
    post: 'Create',
    put: 'Update',
    patch: 'Partially update',
    delete: 'Delete',
    head: 'Check',
    options: 'Get options for',
  };
  return map[method] || method.toUpperCase();
}

// ─── Input Schema Building ───────────────────────────────────────

function buildInputSchema(endpoint: ParsedEndpoint): {
  inputSchema: MCPInputSchema;
  pathParams: string[];
  queryParams: string[];
  headerParams: string[];
  bodyParam?: string;
} {
  const properties: Record<string, MCPProperty> = {};
  const required: string[] = [];
  const pathParams: string[] = [];
  const queryParams: string[] = [];
  const headerParams: string[] = [];

  // Add parameters
  for (const param of endpoint.parameters) {
    const propName = param.in === 'header'
      ? `header_${param.name.toLowerCase().replace(/-/g, '_')}`
      : param.name;

    properties[propName] = schemaToProperty(param.schema, param.description);

    if (param.required) required.push(propName);

    switch (param.in) {
      case 'path': pathParams.push(param.name); break;
      case 'query': queryParams.push(param.name); break;
      case 'header': headerParams.push(propName); break;
    }
  }

  // Add request body
  let bodyParam: string | undefined;
  if (endpoint.requestBody?.schema) {
    const bodySchema = endpoint.requestBody.schema;

    if (bodySchema.type === 'object' && bodySchema.properties) {
      // Flatten body properties into tool input
      for (const [name, prop] of Object.entries(bodySchema.properties)) {
        properties[name] = schemaToProperty(prop, prop.description);
      }
      if (bodySchema.required) {
        for (const r of bodySchema.required) {
          if (!required.includes(r)) required.push(r);
        }
      }
      bodyParam = '__body_object__'; // signal to reconstruct body from flat params
    } else {
      // Non-object body → single "body" property
      properties['body'] = schemaToProperty(bodySchema, endpoint.requestBody.description);
      if (endpoint.requestBody.required) required.push('body');
      bodyParam = 'body';
    }
  }

  return {
    inputSchema: { type: 'object', properties, required },
    pathParams,
    queryParams,
    headerParams,
    bodyParam,
  };
}

function schemaToProperty(schema: SchemaObject, description?: string): MCPProperty {
  const prop: MCPProperty = {
    type: mapSchemaType(schema),
  };

  if (description || schema.description) {
    prop.description = description || schema.description;
  }
  if (schema.enum) prop.enum = schema.enum;
  if (schema.default !== undefined) prop.default = schema.default;
  if (schema.minimum !== undefined) prop.minimum = schema.minimum;
  if (schema.maximum !== undefined) prop.maximum = schema.maximum;
  if (schema.format) prop.format = schema.format;

  if (schema.type === 'array' && schema.items) {
    prop.items = schemaToProperty(schema.items);
  }

  if (schema.type === 'object' && schema.properties) {
    prop.properties = {};
    for (const [name, sub] of Object.entries(schema.properties)) {
      prop.properties[name] = schemaToProperty(sub);
    }
    if (schema.required) prop.required = schema.required;
  }

  return prop;
}

function mapSchemaType(schema: SchemaObject): string {
  if (schema.type === 'integer') return 'number';
  if (schema.type) return schema.type;
  if (schema.properties) return 'object';
  if (schema.items) return 'array';
  if (schema.oneOf || schema.anyOf) return 'string'; // simplified
  return 'string';
}

// ─── Auth Mapping ────────────────────────────────────────────────

function mapAuth(
  requirements: SecurityRequirement[],
  schemes: SecurityScheme[]
): ToolAuth[] {
  const auth: ToolAuth[] = [];

  for (const req of requirements) {
    const scheme = schemes.find(s => s.name === req.schemeName);
    if (!scheme) continue;

    const envVar = generateAuthEnvVar(scheme);
    auth.push({ scheme, envVar });
  }

  return auth;
}

function generateAuthEnvVar(scheme: SecurityScheme): string {
  switch (scheme.type) {
    case 'http':
      if (scheme.scheme === 'bearer') return 'API_BEARER_TOKEN';
      if (scheme.scheme === 'basic') return 'API_BASIC_AUTH';
      return 'API_HTTP_AUTH';
    case 'apiKey':
      return `API_KEY_${(scheme.paramName || scheme.name).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    case 'oauth2':
      return 'API_OAUTH_TOKEN';
    default:
      return `API_AUTH_${scheme.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  }
}

function describeAuthEnvVar(scheme: SecurityScheme): string {
  switch (scheme.type) {
    case 'http':
      if (scheme.scheme === 'bearer') return `Bearer token for API authentication${scheme.bearerFormat ? ` (${scheme.bearerFormat})` : ''}`;
      return `HTTP ${scheme.scheme} credentials`;
    case 'apiKey':
      return `API key (sent as ${scheme.in} parameter "${scheme.paramName}")`;
    case 'oauth2':
      return 'OAuth2 access token';
    default:
      return `Authentication for ${scheme.name}`;
  }
}

export { generateToolName, sanitizeToolName, sanitizeServerName };
