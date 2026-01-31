# ⚡ MCPForge

**Turn any API into an MCP server in seconds.**

MCPForge generates production-ready [Model Context Protocol](https://modelcontextprotocol.io) servers from OpenAPI specs, plain English descriptions, or API documentation URLs. Deploy instantly, share via the public registry, and connect to Claude, GPT, and any MCP-compatible client.

## Features

### 🔧 Generate
- **OpenAPI → MCP Server** — Upload a spec (JSON/YAML), get a working MCP server in TypeScript or Python
- **Plain English → MCP Server** — Describe what you want ("a weather API that gets forecasts by city"), AI generates the spec and server
- **Docs URL → MCP Server** — Point at any API documentation page, we crawl it and generate the server
- **Multi-API Composition** — Combine multiple APIs into a single MCP server with automatic namespacing

### 🚀 Deploy
- **One-click hosting** — Deploy generated servers with a unique URL, connect instantly from Claude Desktop
- **Environment management** — Secure API key storage, hot-reload on config changes
- **Health monitoring** — Auto-restart on crash, live logs, usage analytics
- **Version management** — Diff specs, detect breaking changes, auto-generate migration notes

### 🌐 Community
- **Public registry** — Browse, search, and one-click deploy community servers
- **Fork & customize** — Take any community server and make it your own
- **Star & discover** — Find popular servers across categories
- **GitHub push** — Commit generated servers directly to your repos

### 💻 Developer Tools
- **CLI** — `mcpforge generate openapi.yaml` for local generation without the web UI
- **VS Code Extension** — Generate from spec files, browse registry, CodeLens for OpenAPI files
- **Testing Playground** — Call tools directly in the browser with dynamic forms and cURL preview
- **REST API** — Programmatic access with API key authentication

### 💰 Pricing
| | Free | Pro ($29/mo) | Team ($99/mo) |
|---|---|---|---|
| Generations | 10/mo | 100/mo | Unlimited |
| AI Describe | 5/mo | 50/mo | Unlimited |
| Hosted Servers | — | 10 | Unlimited |
| Analytics | — | ✓ | ✓ |
| API Keys | 1 | 10 | 20 |
| Compute | — | 10k min/mo | 100k min/mo |

## Quick Start

### Web UI
1. Go to [mcpforge.com](https://mcpforge.com)
2. Paste an OpenAPI spec, describe in English, or enter a docs URL
3. Preview generated tools → Download or deploy

### CLI
```bash
npx mcpforge generate ./openapi.yaml --language typescript --output ./my-server
```

### VS Code
1. Install the MCPForge extension
2. Open any OpenAPI spec file → Click "⚡ Generate MCP Server" CodeLens
3. Or use Command Palette → "MCPForge: Describe and Generate"

### Connect to Claude Desktop
```json
{
  "mcpServers": {
    "my-api": {
      "command": "node",
      "args": ["./my-server/dist/index.js"],
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Turso (libSQL) — SQLite compatible, edge-ready
- **Auth:** NextAuth + GitHub OAuth
- **Payments:** Stripe (subscriptions + usage-based compute billing)
- **Testing:** Vitest — 310 tests
- **Code Generation:** TypeScript + Python server scaffolding

## Development

```bash
git clone https://github.com/claudius-inc/mcpforge.git
cd mcpforge
npm install
cp .env.example .env.local  # Configure your env vars
npm run dev                  # Start dev server on :3000
npm test                     # Run 310 tests
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

**Core pipeline:** OpenAPI Spec → Parser → Mapper → Generator → Download/Deploy

```
src/
├── app/              # Next.js pages + API routes
│   ├── api/          # REST endpoints (generate, parse, deploy, billing, registry...)
│   ├── dashboard/    # Server management, billing, API keys
│   └── docs/         # API documentation
├── lib/              # Core engine
│   ├── parser.ts     # OpenAPI 3.0/3.1 spec parser ($ref resolution, allOf composition)
│   ├── mapper.ts     # REST endpoints → MCP tools (name, schema, auth)
│   ├── generator.ts  # Code generation (TypeScript + Python)
│   ├── composer.ts   # Multi-API composition with namespacing
│   └── diff.ts       # Spec version diffing + compatibility detection
├── components/       # React UI (generator, playground, registry, billing...)
└── __tests__/        # 310 tests across 12 test files
```

## License

MIT

---

Built by [Claudius Inc.](https://github.com/claudius-inc)
