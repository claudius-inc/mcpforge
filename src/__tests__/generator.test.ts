import { describe, it, expect } from 'vitest';
import { parseOpenAPISpec } from '../lib/parser';
import { mapSpecToMCPServer } from '../lib/mapper';
import { generateTypeScriptServer } from '../lib/generator/typescript';
import { generatePythonServer } from '../lib/generator/python';
import type { MCPServerConfig } from '../lib/mapper/types';

function getConfig(): MCPServerConfig {
  const spec = `{
    "openapi": "3.0.3",
    "info": { "title": "Weather API", "version": "2.0.0", "description": "Get weather data" },
    "servers": [{ "url": "https://api.weather.io/v2" }],
    "paths": {
      "/forecast": {
        "get": {
          "operationId": "getForecast",
          "summary": "Get weather forecast",
          "parameters": [
            { "name": "city", "in": "query", "required": true, "schema": { "type": "string", "description": "City name" } },
            { "name": "days", "in": "query", "schema": { "type": "integer", "description": "Number of days" } },
            { "name": "units", "in": "query", "schema": { "type": "string", "enum": ["metric", "imperial"] } }
          ],
          "security": [{ "apiKey": [] }],
          "responses": { "200": { "description": "Forecast data" } }
        }
      },
      "/alerts/{region}": {
        "get": {
          "operationId": "getAlerts",
          "summary": "Get weather alerts for a region",
          "parameters": [
            { "name": "region", "in": "path", "required": true, "schema": { "type": "string" } },
            { "name": "severity", "in": "query", "schema": { "type": "string", "enum": ["low", "medium", "high"] } }
          ],
          "security": [{ "apiKey": [] }],
          "responses": { "200": { "description": "Alert list" } }
        }
      },
      "/report": {
        "post": {
          "operationId": "submitReport",
          "summary": "Submit a weather report",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["location", "conditions"],
                  "properties": {
                    "location": { "type": "string" },
                    "conditions": { "type": "string" },
                    "temperature": { "type": "number" },
                    "notes": { "type": "string" }
                  }
                }
              }
            }
          },
          "security": [{ "bearerAuth": [] }],
          "responses": { "201": { "description": "Report submitted" } }
        }
      }
    },
    "components": {
      "securitySchemes": {
        "apiKey": { "type": "apiKey", "in": "header", "name": "X-Weather-Key" },
        "bearerAuth": { "type": "http", "scheme": "bearer" }
      }
    }
  }`;
  const result = parseOpenAPISpec(spec);
  if (!result.success || !result.spec) throw new Error('Parse failed');
  return mapSpecToMCPServer(result.spec);
}

describe('TypeScript Generator', () => {
  const config = getConfig();
  const files = generateTypeScriptServer(config);

  it('generates all expected files', () => {
    expect(files['package.json']).toBeDefined();
    expect(files['tsconfig.json']).toBeDefined();
    expect(files['src/index.ts']).toBeDefined();
    expect(files['src/tools.ts']).toBeDefined();
    expect(files['src/http-client.ts']).toBeDefined();
    expect(files['.env.example']).toBeDefined();
    expect(files['Dockerfile']).toBeDefined();
    expect(files['README.md']).toBeDefined();
  });

  describe('package.json', () => {
    it('has correct name and MCP SDK dependency', () => {
      const pkg = JSON.parse(files['package.json']);
      expect(pkg.name).toBe('mcp-weather-api');
      expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
    });

    it('has build and start scripts', () => {
      const pkg = JSON.parse(files['package.json']);
      expect(pkg.scripts.build).toBe('tsc');
      expect(pkg.scripts.start).toBeDefined();
    });
  });

  describe('server entry (src/index.ts)', () => {
    it('imports McpServer and StdioServerTransport', () => {
      expect(files['src/index.ts']).toContain('McpServer');
      expect(files['src/index.ts']).toContain('StdioServerTransport');
    });

    it('creates server with correct name', () => {
      expect(files['src/index.ts']).toContain("name: 'weather-api'");
    });

    it('registers tools and starts', () => {
      expect(files['src/index.ts']).toContain('registerTools(server)');
      expect(files['src/index.ts']).toContain('server.connect(transport)');
    });
  });

  describe('tool definitions (src/tools.ts)', () => {
    it('imports zod for schema validation', () => {
      expect(files['src/tools.ts']).toContain("import { z } from 'zod'");
    });

    it('registers all 3 tools', () => {
      const toolCount = (files['src/tools.ts'].match(/server\.tool\(/g) || []).length;
      expect(toolCount).toBe(3);
    });

    it('includes getForecast tool with query params', () => {
      expect(files['src/tools.ts']).toContain("'getforecast'");
      expect(files['src/tools.ts']).toContain('city:');
      expect(files['src/tools.ts']).toContain('z.string()');
    });

    it('includes path parameter substitution for getAlerts', () => {
      expect(files['src/tools.ts']).toContain("'getalerts'");
      expect(files['src/tools.ts']).toContain('${params.region}');
    });

    it('includes enum validation', () => {
      expect(files['src/tools.ts']).toContain("z.enum([");
    });

    it('includes bearer auth header for submitReport', () => {
      expect(files['src/tools.ts']).toContain('API_BEARER_TOKEN');
      expect(files['src/tools.ts']).toContain('Authorization');
    });

    it('includes API key header for forecast/alerts', () => {
      expect(files['src/tools.ts']).toContain('X-Weather-Key');
      expect(files['src/tools.ts']).toContain('API_KEY_X_WEATHER_KEY');
    });
  });

  describe('HTTP client', () => {
    it('exports apiRequest function', () => {
      expect(files['src/http-client.ts']).toContain('export async function apiRequest');
    });

    it('handles JSON responses', () => {
      expect(files['src/http-client.ts']).toContain('application/json');
      expect(files['src/http-client.ts']).toContain('response.json()');
    });

    it('has error handling', () => {
      expect(files['src/http-client.ts']).toContain('response.ok');
      expect(files['src/http-client.ts']).toContain('throw new Error');
    });
  });

  describe('env example', () => {
    it('includes API_BASE_URL', () => {
      expect(files['.env.example']).toContain('API_BASE_URL');
      expect(files['.env.example']).toContain('https://api.weather.io/v2');
    });

    it('includes auth env vars', () => {
      expect(files['.env.example']).toContain('API_KEY_X_WEATHER_KEY');
      expect(files['.env.example']).toContain('API_BEARER_TOKEN');
    });
  });

  describe('Dockerfile', () => {
    it('uses multi-stage build', () => {
      expect(files['Dockerfile']).toContain('FROM node:22-slim AS builder');
      expect(files['Dockerfile']).toContain('FROM node:22-slim');
    });

    it('builds TypeScript', () => {
      expect(files['Dockerfile']).toContain('npm run build');
    });
  });

  describe('README', () => {
    it('lists all tools', () => {
      expect(files['README.md']).toContain('getforecast');
      expect(files['README.md']).toContain('getalerts');
      expect(files['README.md']).toContain('submitreport');
    });

    it('includes Claude Desktop config example', () => {
      expect(files['README.md']).toContain('claude_desktop_config.json');
      expect(files['README.md']).toContain('mcpServers');
    });

    it('includes MCPForge attribution', () => {
      expect(files['README.md']).toContain('MCPForge');
    });
  });
});

describe('Python Generator', () => {
  const config = getConfig();
  const files = generatePythonServer(config);

  it('generates all expected files', () => {
    expect(files['pyproject.toml']).toBeDefined();
    expect(files['server.py']).toBeDefined();
    expect(files['.env.example']).toBeDefined();
    expect(files['Dockerfile']).toBeDefined();
    expect(files['README.md']).toBeDefined();
  });

  describe('pyproject.toml', () => {
    it('has correct project name', () => {
      expect(files['pyproject.toml']).toContain('name = "mcp-weather-api"');
    });

    it('depends on mcp and httpx', () => {
      expect(files['pyproject.toml']).toContain('mcp[cli]');
      expect(files['pyproject.toml']).toContain('httpx');
    });
  });

  describe('server.py', () => {
    it('imports FastMCP', () => {
      expect(files['server.py']).toContain('from mcp.server.fastmcp import FastMCP');
    });

    it('creates MCP server instance', () => {
      expect(files['server.py']).toContain('mcp = FastMCP(');
    });

    it('decorates tools with @mcp.tool()', () => {
      const decoratorCount = (files['server.py'].match(/@mcp\.tool\(\)/g) || []).length;
      expect(decoratorCount).toBe(3);
    });

    it('includes async def for each tool', () => {
      expect(files['server.py']).toContain('async def getforecast');
      expect(files['server.py']).toContain('async def getalerts');
      expect(files['server.py']).toContain('async def submitreport');
    });

    it('uses httpx async client', () => {
      expect(files['server.py']).toContain('httpx.AsyncClient()');
    });

    it('includes type hints', () => {
      expect(files['server.py']).toContain('city: str');
      expect(files['server.py']).toContain('-> str');
    });

    it('handles optional params with None default', () => {
      expect(files['server.py']).toContain('| None = None');
    });

    it('includes auth headers', () => {
      expect(files['server.py']).toContain('X-Weather-Key');
      expect(files['server.py']).toContain('Authorization');
    });

    it('includes path param substitution', () => {
      expect(files['server.py']).toContain('{region}');
    });
  });

  describe('Dockerfile', () => {
    it('uses Python base image', () => {
      expect(files['Dockerfile']).toContain('FROM python:');
    });
  });
});

describe('tool disabling', () => {
  it('excluded disabled tools from generated code', () => {
    const config = getConfig();
    // Disable one tool
    config.tools[0].enabled = false;
    
    const tsFiles = generateTypeScriptServer(config);
    const pyFiles = generatePythonServer(config);
    
    // Should only register 2 tools
    const tsToolCount = (tsFiles['src/tools.ts'].match(/server\.tool\(/g) || []).length;
    expect(tsToolCount).toBe(2);
    
    const pyToolCount = (pyFiles['server.py'].match(/@mcp\.tool\(\)/g) || []).length;
    expect(pyToolCount).toBe(2);
  });
});
