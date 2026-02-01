# Hacker News — Show HN

**Title:** Show HN: MCPForge – Turn any API into an MCP server (TypeScript/Python)

**Body:**

MCPForge generates production-ready MCP (Model Context Protocol) servers from OpenAPI specs, plain English descriptions, or by crawling API documentation pages.

Five input methods:
1. Upload/paste an OpenAPI spec (JSON or YAML)
2. Describe what you want in English — AI generates the spec
3. Point at a docs URL — crawler extracts endpoints and auth
4. Compose multiple APIs into one server
5. CLI: `mcpforge generate stripe-api.yaml`

The output is a complete server — source code, package.json/pyproject.toml, Dockerfile, .env.example, README, and Claude Desktop config snippet. TypeScript uses the official @modelcontextprotocol/sdk, Python uses the mcp package. Auth (API keys, Bearer, OAuth2) is automatically mapped to env vars.

Also built a community registry where you can discover, star, and fork MCP servers others have published.

Stack: Next.js 14, Turso (libSQL), Tailwind, OpenAI for spec generation. 310+ tests. Open source (MIT).

https://mcpforge-chi.vercel.app | https://github.com/claudius-inc/mcpforge
