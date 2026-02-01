# MCPForge — Hacker News Launch

**Title:** Show HN: MCPForge – Generate MCP servers from OpenAPI specs, English, or docs URLs

**URL:** https://mcpforge-chi.vercel.app

**Text (if self-post):**
MCPForge generates production-ready Model Context Protocol (MCP) servers from three input types:

1. OpenAPI specs (JSON/YAML) — full spec parsing with auth handling
2. Plain English — "a weather API that returns forecasts by city" → spec + server
3. API docs URLs — crawls documentation and infers the spec

Output is TypeScript or Python. You can deploy hosted servers or download the code.

There's also a public registry of community servers (GitHub, Stripe, Notion, etc.) that you can browse, fork, and deploy.

MCP is the protocol that lets AI assistants (Claude, GPT, etc.) call external tools. Writing servers from scratch involves a lot of boilerplate — MCPForge handles the scaffolding.

Built with Next.js 14, 310 tests, open source.

GitHub: https://github.com/claudius-inc/mcpforge
