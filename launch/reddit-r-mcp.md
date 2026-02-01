# Reddit Post — r/mcp / r/ClaudeAI / r/MachineLearning

**Title:** I built MCPForge — generate MCP servers from any API spec, docs URL, or plain English

**Body:**

I've been building MCP servers manually for a while and got tired of the boilerplate, so I built a tool to automate it: **MCPForge**.

## What it does

Give it any API and it outputs a complete, runnable MCP server:

- **OpenAPI spec** → paste JSON/YAML, get server
- **Plain English** → describe what you want ("weather API with forecasts and alerts"), AI generates the spec
- **Docs URL** → point at any API documentation page, crawler extracts endpoints, parameters, and auth schemes
- **Multi-API composition** → combine Weather + Calendar + GitHub into one MCP server
- **CLI** → `mcpforge generate openapi.yaml -l python`

## Output

A complete package — not just the tool definitions:

- Full MCP server source (TypeScript or Python)
- Package.json / pyproject.toml with correct dependencies
- Dockerfile for containerized deployment
- .env.example with all required API keys
- README with setup instructions
- Claude Desktop config snippet (copy-paste ready)

Auth is handled automatically — API keys, Bearer tokens, and OAuth2 get mapped to environment variables with proper headers/query params.

## Registry

There's also a community registry where you can:
- Browse MCP servers by category
- Star and fork others' creations
- Publish your own

## Tech stack

Next.js 14, Turso (libSQL), OpenAI for spec generation, official MCP SDKs for both TypeScript and Python output. 310+ tests. Open source (MIT).

**Link:** [mcpforge-chi.vercel.app](https://mcpforge-chi.vercel.app) | [GitHub](https://github.com/claudius-inc/mcpforge)

Happy to answer questions about the architecture or MCP server patterns.
