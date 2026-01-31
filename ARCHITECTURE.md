# MCPForge — Architecture

## What It Does
MCPForge turns any API into an MCP (Model Context Protocol) server. Upload an OpenAPI spec → get a production-ready MCP server that AI agents can use.

## Why It Matters
MCP is becoming the standard protocol for AI agent ↔ tool communication. Every company with an API needs an MCP server, but most don't have the expertise to build one. MCPForge bridges that gap.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database**: Turso (libSQL) — same stack as ShipLog for consistency
- **Auth**: GitHub OAuth
- **Code Generation**: Template-based + LLM-enhanced (for descriptions, error handling)
- **MCP SDK**: @modelcontextprotocol/sdk (TypeScript), mcp (Python)
- **Hosting**: Vercel (web app), Fly.io (hosted MCP servers)

## Core Pipeline

```
OpenAPI Spec → Parser → Tool Mapper → Code Generator → Output
     ↓              ↓           ↓              ↓
  Validate    Extract      Map REST       Generate
  3.0/3.1    endpoints    to MCP tools    TS or Python
             + schemas    + handlers      server code
```

### 1. OpenAPI Parser (`src/lib/parser/`)
- Parse OpenAPI 3.0 and 3.1 specs (JSON + YAML)
- Extract: paths, operations, parameters, request bodies, responses, schemas
- Resolve $ref references
- Extract security schemes (apiKey, bearer, oauth2)
- Validate spec completeness

### 2. Tool Mapper (`src/lib/mapper/`)
- Map each operation to an MCP tool:
  - `operationId` or `method_path` → tool name
  - `summary` + `description` → tool description
  - Parameters + request body → tool input schema (JSON Schema)
  - Response schema → tool output description
- Group related endpoints (CRUD → resource-oriented tools)
- Handle pagination patterns
- Map auth requirements to tool-level config

### 3. Code Generator (`src/lib/generator/`)
- **TypeScript target**: Generate complete Node.js MCP server
  - Uses @modelcontextprotocol/sdk
  - HTTP client with proper error handling
  - Type-safe tool handlers
  - Environment variable config for API keys
  - package.json with all dependencies
- **Python target**: Generate complete Python MCP server
  - Uses mcp Python SDK
  - httpx for HTTP calls
  - Type hints throughout
  - pyproject.toml with dependencies

### 4. Output Manager (`src/lib/output/`)
- Bundle generated files into downloadable .zip
- Generate README with setup instructions
- Include .env.example with required variables
- Add Dockerfile for containerized deployment

## Database Schema

```sql
-- Users (GitHub OAuth)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  github_login TEXT NOT NULL,
  email TEXT,
  plan TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Generated servers
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  spec_hash TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'typescript', -- typescript | python
  tool_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'generated', -- generated | deployed | stopped
  deploy_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Stored OpenAPI specs
CREATE TABLE specs (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id),
  content TEXT NOT NULL,
  version TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Generated tool definitions (for preview/editing)
CREATE TABLE tools (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id),
  name TEXT NOT NULL,
  description TEXT,
  input_schema TEXT, -- JSON
  source_path TEXT,
  source_method TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## API Routes

```
POST   /api/parse          — Upload OpenAPI spec, get parsed tool list
POST   /api/generate       — Generate MCP server code from parsed spec
GET    /api/download/:id   — Download generated server as .zip
POST   /api/deploy/:id     — Deploy server to hosted infrastructure
GET    /api/servers        — List user's servers
GET    /api/servers/:id    — Server details + tools
DELETE /api/servers/:id    — Delete server
PATCH  /api/servers/:id/tools — Enable/disable/edit individual tools
```

## Pages

```
/                          — Landing page
/generate                  — Main generation UI (paste/upload spec)
/dashboard                 — User's servers list
/dashboard/:id             — Server detail (tools, config, deploy)
/dashboard/:id/edit        — Edit generated tools before download
/explore                   — Public server registry (Phase 5)
/docs                      — Documentation
/pricing                   — Plans
```
