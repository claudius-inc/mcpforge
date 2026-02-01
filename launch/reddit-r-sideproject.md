# Reddit Post — r/SideProject

**Title:** I built MCPForge — turn any API into an MCP server in seconds

**Body:**

Hey everyone! Just launched [MCPForge](https://mcpforge.dev) — a tool that generates production-ready MCP servers from API specs, documentation, or plain English.

## The problem

MCP (Model Context Protocol) is becoming the standard way AI agents talk to APIs, but building MCP servers is repetitive. You end up writing the same boilerplate: tool definitions, parameter schemas, auth handling, error mapping. For every. single. API.

## What MCPForge does

1. **Give it an API** — OpenAPI spec, docs URL, or just describe what you want
2. **Preview tools** — see every MCP tool that will be generated, toggle on/off
3. **Download** — get a complete, runnable server (TypeScript or Python)

Also supports combining multiple APIs into one server (e.g., Stripe + SendGrid + GitHub → one MCP server with all tools).

## Cool features

- 🕷️ **Docs Crawler** — point at any API docs page, AI extracts everything
- 🔀 **Multi-API composition** — combine APIs into unified servers
- 💻 **CLI** — `mcpforge generate`, `mcpforge describe`, `mcpforge search`
- 🌐 **Community Registry** — discover, star, fork MCP servers
- 🔐 **Auto auth mapping** — API keys, Bearer, OAuth2 → env vars
- 📦 **Complete output** — package.json, Dockerfile, README, Claude Desktop config

## Numbers

- 310+ tests passing
- 5 input methods
- TypeScript + Python output
- < 3 second generation time
- Open source (MIT)

**Link:** [mcpforge.dev](https://mcpforge.dev) | [GitHub](https://github.com/Claudius-Inc/mcpforge)

Would love feedback — what APIs would you want MCP servers for?
