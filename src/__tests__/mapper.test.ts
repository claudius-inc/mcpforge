import { describe, it, expect } from 'vitest';
import { parseOpenAPISpec } from '../lib/parser';
import { mapSpecToMCPServer } from '../lib/mapper';
import type { MCPServerConfig } from '../lib/mapper/types';

function parseAndMap(specJson: string): MCPServerConfig {
  const result = parseOpenAPISpec(specJson);
  if (!result.success || !result.spec) throw new Error('Parse failed: ' + JSON.stringify(result.errors));
  return mapSpecToMCPServer(result.spec);
}

const PETSTORE = `{
  "openapi": "3.0.3",
  "info": { "title": "Pet Store API", "version": "1.0.0", "description": "A sample pet store" },
  "servers": [{ "url": "https://petstore.example.com/v1" }],
  "paths": {
    "/pets": {
      "get": {
        "operationId": "listPets",
        "summary": "List all pets",
        "tags": ["pets"],
        "parameters": [
          { "name": "limit", "in": "query", "schema": { "type": "integer", "minimum": 1, "maximum": 100 } },
          { "name": "status", "in": "query", "schema": { "type": "string", "enum": ["active", "adopted"] } }
        ],
        "responses": { "200": { "description": "OK" } }
      },
      "post": {
        "operationId": "createPet",
        "summary": "Create a pet",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["name"],
                "properties": {
                  "name": { "type": "string", "description": "Pet name" },
                  "species": { "type": "string" },
                  "age": { "type": "integer" }
                }
              }
            }
          }
        },
        "security": [{ "bearerAuth": [] }],
        "responses": { "201": { "description": "Created" } }
      }
    },
    "/pets/{petId}": {
      "get": {
        "operationId": "getPet",
        "summary": "Get a pet by ID",
        "parameters": [
          { "name": "petId", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": { "200": { "description": "OK" } }
      },
      "delete": {
        "operationId": "deletePet",
        "summary": "Delete a pet",
        "parameters": [
          { "name": "petId", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "security": [{ "bearerAuth": [] }],
        "responses": { "204": { "description": "Deleted" } }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT" }
    }
  }
}`;

describe('Tool Mapper', () => {
  describe('server config', () => {
    it('generates a sanitized server name from title', () => {
      const config = parseAndMap(PETSTORE);
      expect(config.name).toBe('pet-store-api');
    });

    it('carries version and description', () => {
      const config = parseAndMap(PETSTORE);
      expect(config.version).toBe('1.0.0');
      expect(config.description).toBe('A sample pet store');
    });

    it('uses first server URL as baseUrl', () => {
      const config = parseAndMap(PETSTORE);
      expect(config.baseUrl).toBe('https://petstore.example.com/v1');
    });
  });

  describe('tool generation', () => {
    it('creates one tool per endpoint', () => {
      const config = parseAndMap(PETSTORE);
      expect(config.tools).toHaveLength(4);
    });

    it('uses operationId as tool name', () => {
      const config = parseAndMap(PETSTORE);
      const names = config.tools.map(t => t.name);
      expect(names).toContain('listpets');
      expect(names).toContain('createpet');
      expect(names).toContain('getpet');
      expect(names).toContain('deletepet');
    });

    it('uses summary as description', () => {
      const config = parseAndMap(PETSTORE);
      const listPets = config.tools.find(t => t.name === 'listpets')!;
      expect(listPets.description).toBe('List all pets');
    });

    it('all tools are enabled by default', () => {
      const config = parseAndMap(PETSTORE);
      expect(config.tools.every(t => t.enabled)).toBe(true);
    });
  });

  describe('input schema building', () => {
    it('maps query params to tool input properties', () => {
      const config = parseAndMap(PETSTORE);
      const listPets = config.tools.find(t => t.name === 'listpets')!;
      
      expect(listPets.inputSchema.properties['limit']).toBeDefined();
      expect(listPets.inputSchema.properties['limit'].type).toBe('number');
      expect(listPets.inputSchema.properties['status']).toBeDefined();
    });

    it('maps path params as required', () => {
      const config = parseAndMap(PETSTORE);
      const getPet = config.tools.find(t => t.name === 'getpet')!;
      
      expect(getPet.inputSchema.properties['petId']).toBeDefined();
      expect(getPet.inputSchema.required).toContain('petId');
    });

    it('flattens object request body into tool properties', () => {
      const config = parseAndMap(PETSTORE);
      const createPet = config.tools.find(t => t.name === 'createpet')!;
      
      expect(createPet.inputSchema.properties['name']).toBeDefined();
      expect(createPet.inputSchema.properties['species']).toBeDefined();
      expect(createPet.inputSchema.properties['age']).toBeDefined();
      expect(createPet.inputSchema.required).toContain('name');
    });

    it('preserves enum constraints', () => {
      const config = parseAndMap(PETSTORE);
      const listPets = config.tools.find(t => t.name === 'listpets')!;
      
      expect(listPets.inputSchema.properties['status'].enum).toEqual(['active', 'adopted']);
    });
  });

  describe('handler config', () => {
    it('sets correct HTTP method', () => {
      const config = parseAndMap(PETSTORE);
      const listPets = config.tools.find(t => t.name === 'listpets')!;
      const createPet = config.tools.find(t => t.name === 'createpet')!;
      
      expect(listPets.handler.method).toBe('GET');
      expect(createPet.handler.method).toBe('POST');
    });

    it('identifies path params in handler', () => {
      const config = parseAndMap(PETSTORE);
      const getPet = config.tools.find(t => t.name === 'getpet')!;
      
      expect(getPet.handler.pathParams).toEqual(['petId']);
      expect(getPet.handler.path).toBe('/pets/{petId}');
    });

    it('identifies query params in handler', () => {
      const config = parseAndMap(PETSTORE);
      const listPets = config.tools.find(t => t.name === 'listpets')!;
      
      expect(listPets.handler.queryParams).toEqual(['limit', 'status']);
    });

    it('sets bodyParam for request body tools', () => {
      const config = parseAndMap(PETSTORE);
      const createPet = config.tools.find(t => t.name === 'createpet')!;
      
      expect(createPet.handler.bodyParam).toBe('__body_object__');
    });
  });

  describe('auth mapping', () => {
    it('maps bearer auth to env var', () => {
      const config = parseAndMap(PETSTORE);
      const createPet = config.tools.find(t => t.name === 'createpet')!;
      
      expect(createPet.handler.auth).toHaveLength(1);
      expect(createPet.handler.auth[0].envVar).toBe('API_BEARER_TOKEN');
      expect(createPet.handler.auth[0].scheme.type).toBe('http');
    });

    it('no auth on public endpoints', () => {
      const config = parseAndMap(PETSTORE);
      const listPets = config.tools.find(t => t.name === 'listpets')!;
      
      expect(listPets.handler.auth).toHaveLength(0);
    });

    it('collects env vars from all tools', () => {
      const config = parseAndMap(PETSTORE);
      const envVarNames = config.envVars.map(v => v.name);
      
      expect(envVarNames).toContain('API_BASE_URL');
      expect(envVarNames).toContain('API_BEARER_TOKEN');
    });
  });

  describe('deprecated endpoints', () => {
    it('skips deprecated endpoints', () => {
      const spec = `{
        "openapi": "3.0.3",
        "info": {"title":"T","version":"1"},
        "paths": {
          "/old": { "get": { "deprecated": true, "responses": {"200":{"description":"ok"}} } },
          "/new": { "get": { "responses": {"200":{"description":"ok"}} } }
        }
      }`;
      const config = parseAndMap(spec);
      expect(config.tools).toHaveLength(1);
      expect(config.tools[0].handler.path).toBe('/new');
    });
  });

  describe('auto-generated names', () => {
    it('generates tool name from method + path when no operationId', () => {
      const spec = `{
        "openapi": "3.0.3",
        "info": {"title":"T","version":"1"},
        "paths": {
          "/users/{userId}/posts": {
            "get": { "responses": {"200":{"description":"ok"}} },
            "post": { "responses": {"201":{"description":"ok"}} }
          }
        }
      }`;
      const config = parseAndMap(spec);
      const names = config.tools.map(t => t.name);
      
      // Should have verb prefixes
      expect(names.find(n => n.includes('get'))).toBeDefined();
      expect(names.find(n => n.includes('create'))).toBeDefined();
    });
  });
});
