/** Core types for parsed OpenAPI specs */

export interface ParsedSpec {
  title: string;
  description: string;
  version: string;
  baseUrl: string;
  servers: ServerInfo[];
  endpoints: ParsedEndpoint[];
  securitySchemes: SecurityScheme[];
  schemas: Record<string, SchemaObject>;
}

export interface ServerInfo {
  url: string;
  description?: string;
}

export interface ParsedEndpoint {
  path: string;
  method: HttpMethod;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: Record<string, ParsedResponse>;
  security: SecurityRequirement[];
  deprecated: boolean;
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export interface ParsedParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required: boolean;
  schema: SchemaObject;
  example?: unknown;
}

export interface ParsedRequestBody {
  description?: string;
  required: boolean;
  contentType: string;
  schema: SchemaObject;
}

export interface ParsedResponse {
  statusCode: string;
  description: string;
  contentType?: string;
  schema?: SchemaObject;
}

export interface SecurityScheme {
  name: string;
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  scheme?: string; // bearer, basic, etc.
  bearerFormat?: string;
  in?: 'query' | 'header' | 'cookie';
  paramName?: string; // for apiKey type
  flows?: OAuthFlows;
  description?: string;
}

export interface OAuthFlows {
  authorizationCode?: OAuthFlow;
  implicit?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  password?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface SecurityRequirement {
  schemeName: string;
  scopes: string[];
}

export interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  nullable?: boolean;
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  allOf?: SchemaObject[];
  $ref?: string;
  additionalProperties?: boolean | SchemaObject;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface ParseResult {
  success: boolean;
  spec?: ParsedSpec;
  errors: ParseError[];
  warnings: string[];
}

export interface ParseError {
  path: string;
  message: string;
}
