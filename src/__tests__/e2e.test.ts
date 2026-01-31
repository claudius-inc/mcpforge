import { describe, it, expect } from 'vitest';
import { parseOpenAPISpec } from '../lib/parser';
import { mapSpecToMCPServer } from '../lib/mapper';
import { generateTypeScriptServer } from '../lib/generator/typescript';
import { generatePythonServer } from '../lib/generator/python';
import { createZipBundle } from '../lib/output/zip-bundle';

/** Full pipeline: real-world OpenAPI specs → MCP servers */

const STRIPE_LIKE_SPEC = `{
  "openapi": "3.0.3",
  "info": { "title": "Stripe-like Payment API", "version": "2024.1.0" },
  "servers": [{ "url": "https://api.stripe-like.com/v1" }],
  "paths": {
    "/charges": {
      "get": {
        "operationId": "listCharges",
        "summary": "List all charges",
        "parameters": [
          { "name": "limit", "in": "query", "schema": { "type": "integer", "minimum": 1, "maximum": 100 } },
          { "name": "starting_after", "in": "query", "schema": { "type": "string" } },
          { "name": "created[gte]", "in": "query", "schema": { "type": "integer" } }
        ],
        "security": [{ "bearerAuth": [] }],
        "responses": { "200": { "description": "List of charges" } }
      },
      "post": {
        "operationId": "createCharge",
        "summary": "Create a charge",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["amount", "currency"],
                "properties": {
                  "amount": { "type": "integer", "description": "Amount in cents" },
                  "currency": { "type": "string", "description": "Three-letter ISO currency code" },
                  "description": { "type": "string" },
                  "metadata": { "type": "object" }
                }
              }
            }
          }
        },
        "security": [{ "bearerAuth": [] }],
        "responses": { "201": { "description": "Charge created" } }
      }
    },
    "/charges/{chargeId}": {
      "get": {
        "operationId": "retrieveCharge",
        "parameters": [
          { "name": "chargeId", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "security": [{ "bearerAuth": [] }],
        "responses": { "200": { "description": "Charge details" } }
      }
    },
    "/refunds": {
      "post": {
        "operationId": "createRefund",
        "summary": "Create a refund",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["charge"],
                "properties": {
                  "charge": { "type": "string", "description": "ID of the charge to refund" },
                  "amount": { "type": "integer", "description": "Amount to refund in cents (partial refund)" },
                  "reason": { "type": "string", "enum": ["duplicate", "fraudulent", "requested_by_customer"] }
                }
              }
            }
          }
        },
        "security": [{ "bearerAuth": [] }],
        "responses": { "201": { "description": "Refund created" } }
      }
    },
    "/customers": {
      "get": {
        "operationId": "listCustomers",
        "summary": "List customers",
        "parameters": [
          { "name": "email", "in": "query", "schema": { "type": "string" } },
          { "name": "limit", "in": "query", "schema": { "type": "integer" } }
        ],
        "security": [{ "bearerAuth": [] }],
        "responses": { "200": { "description": "Customer list" } }
      },
      "post": {
        "operationId": "createCustomer",
        "summary": "Create a customer",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "email": { "type": "string", "format": "email" },
                  "name": { "type": "string" },
                  "phone": { "type": "string" }
                }
              }
            }
          }
        },
        "security": [{ "bearerAuth": [] }],
        "responses": { "201": { "description": "Customer created" } }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": { "type": "http", "scheme": "bearer" }
    }
  }
}`;

const GITHUB_LIKE_SPEC = `{
  "openapi": "3.1.0",
  "info": { "title": "GitHub-like API", "version": "3.0.0" },
  "servers": [{ "url": "https://api.github-like.com" }],
  "paths": {
    "/repos/{owner}/{repo}": {
      "get": {
        "operationId": "getRepo",
        "summary": "Get a repository",
        "parameters": [
          { "name": "owner", "in": "path", "required": true, "schema": { "type": "string" } },
          { "name": "repo", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": { "200": { "description": "Repository details" } }
      }
    },
    "/repos/{owner}/{repo}/issues": {
      "get": {
        "operationId": "listIssues",
        "summary": "List repository issues",
        "parameters": [
          { "name": "owner", "in": "path", "required": true, "schema": { "type": "string" } },
          { "name": "repo", "in": "path", "required": true, "schema": { "type": "string" } },
          { "name": "state", "in": "query", "schema": { "type": "string", "enum": ["open", "closed", "all"] } },
          { "name": "labels", "in": "query", "schema": { "type": "string" } },
          { "name": "sort", "in": "query", "schema": { "type": "string", "enum": ["created", "updated", "comments"] } },
          { "name": "per_page", "in": "query", "schema": { "type": "integer" } }
        ],
        "security": [{ "tokenAuth": [] }],
        "responses": { "200": { "description": "Issue list" } }
      },
      "post": {
        "operationId": "createIssue",
        "summary": "Create an issue",
        "parameters": [
          { "name": "owner", "in": "path", "required": true, "schema": { "type": "string" } },
          { "name": "repo", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["title"],
                "properties": {
                  "title": { "type": "string" },
                  "body": { "type": "string" },
                  "labels": { "type": "array", "items": { "type": "string" } },
                  "assignees": { "type": "array", "items": { "type": "string" } }
                }
              }
            }
          }
        },
        "security": [{ "tokenAuth": [] }],
        "responses": { "201": { "description": "Issue created" } }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "tokenAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "token" }
    }
  }
}`;

describe('End-to-End: Stripe-like API', () => {
  it('full pipeline produces valid TypeScript server', () => {
    const parseResult = parseOpenAPISpec(STRIPE_LIKE_SPEC);
    expect(parseResult.success).toBe(true);

    const config = mapSpecToMCPServer(parseResult.spec!);
    expect(config.tools).toHaveLength(6);
    expect(config.name).toBe('stripe-like-payment-api');

    const files = generateTypeScriptServer(config);
    expect(Object.keys(files)).toHaveLength(8);

    // Verify tool names
    const toolsFile = files['src/tools.ts'];
    expect(toolsFile).toContain('listcharges');
    expect(toolsFile).toContain('createcharge');
    expect(toolsFile).toContain('retrievecharge');
    expect(toolsFile).toContain('createrefund');
    expect(toolsFile).toContain('listcustomers');
    expect(toolsFile).toContain('createcustomer');

    // Verify auth
    expect(toolsFile).toContain('API_BEARER_TOKEN');

    // Verify enum in refund
    expect(toolsFile).toContain("'duplicate'");
    expect(toolsFile).toContain("'fraudulent'");
  });

  it('full pipeline produces valid Python server', () => {
    const parseResult = parseOpenAPISpec(STRIPE_LIKE_SPEC);
    const config = mapSpecToMCPServer(parseResult.spec!);
    const files = generatePythonServer(config);

    expect(files['server.py']).toContain('async def listcharges');
    expect(files['server.py']).toContain('async def createcharge');
    expect(files['server.py']).toContain('amount: float');
    expect(files['server.py']).toContain('currency: str');
  });
});

describe('End-to-End: GitHub-like API', () => {
  it('handles multiple path params correctly', () => {
    const parseResult = parseOpenAPISpec(GITHUB_LIKE_SPEC);
    expect(parseResult.success).toBe(true);

    const config = mapSpecToMCPServer(parseResult.spec!);
    const getRepo = config.tools.find(t => t.name === 'getrepo')!;
    
    expect(getRepo.handler.pathParams).toEqual(['owner', 'repo']);
    expect(getRepo.inputSchema.required).toContain('owner');
    expect(getRepo.inputSchema.required).toContain('repo');
  });

  it('generates TypeScript with correct path interpolation', () => {
    const parseResult = parseOpenAPISpec(GITHUB_LIKE_SPEC);
    const config = mapSpecToMCPServer(parseResult.spec!);
    const files = generateTypeScriptServer(config);

    expect(files['src/tools.ts']).toContain('${params.owner}');
    expect(files['src/tools.ts']).toContain('${params.repo}');
  });

  it('handles array type params in Python', () => {
    const parseResult = parseOpenAPISpec(GITHUB_LIKE_SPEC);
    const config = mapSpecToMCPServer(parseResult.spec!);
    const files = generatePythonServer(config);

    // labels and assignees should be list type
    expect(files['server.py']).toContain('labels: list');
    expect(files['server.py']).toContain('assignees: list');
  });
});

describe('ZIP bundling', () => {
  it('creates a valid ZIP buffer', async () => {
    const parseResult = parseOpenAPISpec(STRIPE_LIKE_SPEC);
    const config = mapSpecToMCPServer(parseResult.spec!);
    const files = generateTypeScriptServer(config);

    const zipBuffer = await createZipBundle(files, 'mcp-test');
    
    expect(zipBuffer).toBeInstanceOf(Buffer);
    expect(zipBuffer.length).toBeGreaterThan(0);
    
    // ZIP magic bytes: PK\x03\x04
    expect(zipBuffer[0]).toBe(0x50); // P
    expect(zipBuffer[1]).toBe(0x4B); // K
  });

  it('bundles all files with folder prefix', async () => {
    const files = { 'a.txt': 'hello', 'dir/b.txt': 'world' };
    const zip = await createZipBundle(files, 'test-folder');
    
    expect(zip.length).toBeGreaterThan(0);
    // ZIP is valid (starts with magic)
    expect(zip[0]).toBe(0x50);
  });
});

describe('edge cases', () => {
  it('handles spec with no servers', () => {
    const spec = `{
      "openapi": "3.0.3",
      "info": {"title":"No Servers","version":"1"},
      "paths": { "/test": { "get": { "responses": {"200":{"description":"ok"}} } } }
    }`;
    const result = parseOpenAPISpec(spec);
    expect(result.success).toBe(true);
    expect(result.spec!.baseUrl).toBe('https://api.example.com');
  });

  it('handles spec with no description', () => {
    const spec = `{
      "openapi": "3.0.3",
      "info": {"title":"Minimal","version":"1"},
      "paths": { "/test": { "get": { "responses": {"200":{"description":"ok"}} } } }
    }`;
    const config = mapSpecToMCPServer(parseOpenAPISpec(spec).spec!);
    expect(config.description).toContain('Minimal');
  });

  it('handles very long operation IDs', () => {
    const spec = `{
      "openapi": "3.0.3",
      "info": {"title":"T","version":"1"},
      "paths": { "/test": { "get": {
        "operationId": "${'a'.repeat(100)}",
        "responses": {"200":{"description":"ok"}}
      }}}
    }`;
    const config = mapSpecToMCPServer(parseOpenAPISpec(spec).spec!);
    expect(config.tools[0].name.length).toBeLessThanOrEqual(64);
  });

  it('handles special chars in API title', () => {
    const spec = `{
      "openapi": "3.0.3",
      "info": {"title":"My API v2.0 (Beta)","version":"1"},
      "paths": { "/test": { "get": { "responses": {"200":{"description":"ok"}} } } }
    }`;
    const config = mapSpecToMCPServer(parseOpenAPISpec(spec).spec!);
    expect(config.name).toMatch(/^[a-z0-9-]+$/);
  });
});
