import { describe, it, expect } from 'vitest';
import { parseOpenAPISpec } from '../lib/parser';

const MINIMAL_SPEC = `{
  "openapi": "3.0.3",
  "info": { "title": "Pet Store", "version": "1.0.0" },
  "paths": {
    "/pets": {
      "get": {
        "operationId": "listPets",
        "summary": "List all pets",
        "parameters": [
          { "name": "limit", "in": "query", "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": {
            "description": "A list of pets",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": { "$ref": "#/components/schemas/Pet" }
                }
              }
            }
          }
        }
      },
      "post": {
        "operationId": "createPet",
        "summary": "Create a pet",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/Pet" }
            }
          }
        },
        "responses": {
          "201": { "description": "Pet created" }
        }
      }
    },
    "/pets/{petId}": {
      "get": {
        "operationId": "showPetById",
        "summary": "Info for a specific pet",
        "parameters": [
          { "name": "petId", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": {
            "description": "A pet",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Pet" }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Pet": {
        "type": "object",
        "required": ["id", "name"],
        "properties": {
          "id": { "type": "integer", "format": "int64" },
          "name": { "type": "string" },
          "tag": { "type": "string" }
        }
      }
    }
  }
}`;

const YAML_SPEC = `openapi: "3.0.3"
info:
  title: YAML API
  version: "2.0.0"
servers:
  - url: https://yaml-api.example.com
paths:
  /items:
    get:
      operationId: listItems
      summary: List items
      responses:
        "200":
          description: OK
`;

const SPEC_WITH_AUTH = `{
  "openapi": "3.0.3",
  "info": { "title": "Secured API", "version": "1.0.0" },
  "paths": {
    "/data": {
      "get": {
        "operationId": "getData",
        "summary": "Get data",
        "security": [{ "bearerAuth": [] }],
        "responses": { "200": { "description": "OK" } }
      }
    },
    "/admin": {
      "post": {
        "operationId": "adminAction",
        "security": [{ "apiKeyAuth": [] }],
        "requestBody": {
          "content": { "application/json": { "schema": { "type": "object", "properties": { "action": { "type": "string" } } } } }
        },
        "responses": { "200": { "description": "OK" } }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      },
      "apiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key"
      }
    }
  }
}`;

describe('OpenAPI Parser', () => {
  describe('basic parsing', () => {
    it('parses a minimal JSON OpenAPI spec', () => {
      const result = parseOpenAPISpec(MINIMAL_SPEC);
      expect(result.success).toBe(true);
      expect(result.spec).toBeDefined();
      expect(result.spec!.title).toBe('Pet Store');
      expect(result.spec!.version).toBe('1.0.0');
    });

    it('extracts all endpoints', () => {
      const result = parseOpenAPISpec(MINIMAL_SPEC);
      expect(result.spec!.endpoints).toHaveLength(3);
      
      const ops = result.spec!.endpoints.map(e => e.operationId);
      expect(ops).toContain('listPets');
      expect(ops).toContain('createPet');
      expect(ops).toContain('showPetById');
    });

    it('extracts endpoint methods correctly', () => {
      const result = parseOpenAPISpec(MINIMAL_SPEC);
      const listPets = result.spec!.endpoints.find(e => e.operationId === 'listPets');
      const createPet = result.spec!.endpoints.find(e => e.operationId === 'createPet');
      
      expect(listPets!.method).toBe('get');
      expect(createPet!.method).toBe('post');
    });

    it('extracts query parameters', () => {
      const result = parseOpenAPISpec(MINIMAL_SPEC);
      const listPets = result.spec!.endpoints.find(e => e.operationId === 'listPets')!;
      
      expect(listPets.parameters).toHaveLength(1);
      expect(listPets.parameters[0].name).toBe('limit');
      expect(listPets.parameters[0].in).toBe('query');
      expect(listPets.parameters[0].schema.type).toBe('integer');
    });

    it('extracts path parameters', () => {
      const result = parseOpenAPISpec(MINIMAL_SPEC);
      const showPet = result.spec!.endpoints.find(e => e.operationId === 'showPetById')!;
      
      expect(showPet.parameters).toHaveLength(1);
      expect(showPet.parameters[0].name).toBe('petId');
      expect(showPet.parameters[0].in).toBe('path');
      expect(showPet.parameters[0].required).toBe(true);
    });

    it('extracts request body', () => {
      const result = parseOpenAPISpec(MINIMAL_SPEC);
      const createPet = result.spec!.endpoints.find(e => e.operationId === 'createPet')!;
      
      expect(createPet.requestBody).toBeDefined();
      expect(createPet.requestBody!.required).toBe(true);
      expect(createPet.requestBody!.contentType).toBe('application/json');
    });

    it('extracts responses', () => {
      const result = parseOpenAPISpec(MINIMAL_SPEC);
      const listPets = result.spec!.endpoints.find(e => e.operationId === 'listPets')!;
      
      expect(listPets.responses['200']).toBeDefined();
      expect(listPets.responses['200'].description).toBe('A list of pets');
    });
  });

  describe('YAML support', () => {
    it('parses YAML specs', () => {
      const result = parseOpenAPISpec(YAML_SPEC);
      expect(result.success).toBe(true);
      expect(result.spec!.title).toBe('YAML API');
      expect(result.spec!.version).toBe('2.0.0');
    });

    it('extracts servers from YAML', () => {
      const result = parseOpenAPISpec(YAML_SPEC);
      expect(result.spec!.servers).toHaveLength(1);
      expect(result.spec!.baseUrl).toBe('https://yaml-api.example.com');
    });
  });

  describe('$ref resolution', () => {
    it('resolves component schema references', () => {
      const result = parseOpenAPISpec(MINIMAL_SPEC);
      expect(result.spec!.schemas['Pet']).toBeDefined();
      expect(result.spec!.schemas['Pet'].type).toBe('object');
      expect(result.spec!.schemas['Pet'].properties).toBeDefined();
      expect(result.spec!.schemas['Pet'].properties!.name.type).toBe('string');
    });

    it('resolves $ref in request body schemas', () => {
      const result = parseOpenAPISpec(MINIMAL_SPEC);
      const createPet = result.spec!.endpoints.find(e => e.operationId === 'createPet')!;
      
      // Should have resolved the Pet $ref
      expect(createPet.requestBody!.schema.type).toBe('object');
      expect(createPet.requestBody!.schema.properties).toBeDefined();
    });
  });

  describe('security schemes', () => {
    it('extracts bearer token auth', () => {
      const result = parseOpenAPISpec(SPEC_WITH_AUTH);
      const bearer = result.spec!.securitySchemes.find(s => s.name === 'bearerAuth');
      
      expect(bearer).toBeDefined();
      expect(bearer!.type).toBe('http');
      expect(bearer!.scheme).toBe('bearer');
      expect(bearer!.bearerFormat).toBe('JWT');
    });

    it('extracts API key auth', () => {
      const result = parseOpenAPISpec(SPEC_WITH_AUTH);
      const apiKey = result.spec!.securitySchemes.find(s => s.name === 'apiKeyAuth');
      
      expect(apiKey).toBeDefined();
      expect(apiKey!.type).toBe('apiKey');
      expect(apiKey!.in).toBe('header');
      expect(apiKey!.paramName).toBe('X-API-Key');
    });

    it('assigns security requirements to endpoints', () => {
      const result = parseOpenAPISpec(SPEC_WITH_AUTH);
      const getData = result.spec!.endpoints.find(e => e.operationId === 'getData')!;
      
      expect(getData.security).toHaveLength(1);
      expect(getData.security[0].schemeName).toBe('bearerAuth');
    });
  });

  describe('error handling', () => {
    it('rejects invalid JSON', () => {
      const result = parseOpenAPISpec('not json {{{');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects OpenAPI 2.x (Swagger)', () => {
      const result = parseOpenAPISpec('{"swagger": "2.0", "info": {}, "paths": {}}');
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Unsupported');
    });

    it('warns on empty paths', () => {
      const result = parseOpenAPISpec('{"openapi": "3.0.3", "info": {"title":"X","version":"1"}, "paths": {}}');
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('allOf composition', () => {
    it('merges allOf schemas', () => {
      const spec = `{
        "openapi": "3.0.3",
        "info": {"title":"Composed","version":"1"},
        "paths": {
          "/item": {
            "get": {
              "responses": {
                "200": {
                  "description": "ok",
                  "content": {
                    "application/json": {
                      "schema": {
                        "allOf": [
                          { "type": "object", "properties": { "id": { "type": "integer" } }, "required": ["id"] },
                          { "type": "object", "properties": { "name": { "type": "string" } }, "required": ["name"] }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`;
      const result = parseOpenAPISpec(spec);
      expect(result.success).toBe(true);
      
      const response = result.spec!.endpoints[0].responses['200'];
      expect(response.schema!.properties).toBeDefined();
      expect(response.schema!.properties!.id).toBeDefined();
      expect(response.schema!.properties!.name).toBeDefined();
      expect(response.schema!.required).toEqual(['id', 'name']);
    });
  });
});
