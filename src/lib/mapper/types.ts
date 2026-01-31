import type { SecurityScheme } from '../parser/types';

/** An MCP tool definition derived from an API endpoint */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPInputSchema;
  handler: ToolHandler;
  source: ToolSource;
  enabled: boolean;
}

export interface MCPInputSchema {
  type: 'object';
  properties: Record<string, MCPProperty>;
  required: string[];
}

export interface MCPProperty {
  type: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: MCPProperty;
  properties?: Record<string, MCPProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  format?: string;
}

/** How to call the underlying API */
export interface ToolHandler {
  method: string;
  path: string;          // with {param} placeholders
  baseUrl: string;
  baseUrlEnvVar?: string; // defaults to API_BASE_URL; composer sets per-API vars
  contentType: string;
  pathParams: string[];
  queryParams: string[];
  headerParams: string[];
  bodyParam?: string;     // property name containing the request body
  auth: ToolAuth[];
}

export interface ToolAuth {
  scheme: SecurityScheme;
  envVar: string;         // e.g., API_KEY, BEARER_TOKEN
}

/** Where this tool came from */
export interface ToolSource {
  path: string;
  method: string;
  operationId?: string;
}

/** Complete MCP server configuration */
export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  tools: MCPTool[];
  envVars: EnvVar[];
}

export interface EnvVar {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}
