# MCPForge Reddit Launch Posts

## r/ClaudeAI

**Title:** I built MCPForge — turn any API into an MCP server in seconds (free)

**Body:**
Hey! I built [MCPForge](https://mcpforge-chi.vercel.app) to solve a problem I kept hitting: writing MCP servers from scratch for every API I wanted to connect to Claude.

**What it does:**
- Paste an OpenAPI spec → get a working MCP server (TypeScript or Python)
- Describe an API in plain English → AI generates the spec + server
- Paste a docs URL → it crawls the page and generates everything
- Browse a public registry of community-built servers

**Why MCP matters:** MCP lets Claude (and other AI clients) call external tools natively. Instead of copy-pasting API responses, your AI can directly query databases, check weather, manage repos, etc.

**Pricing:** Free tier with 10 generations/month. Pro at $29/mo for hosted servers + more generations.

The registry already has servers for GitHub, Stripe, OpenWeather, Notion, and more.

Try it: [mcpforge-chi.vercel.app](https://mcpforge-chi.vercel.app)

---

## r/LocalLLaMA

**Title:** MCPForge — Free tool to generate MCP servers from any OpenAPI spec (works with any MCP client)

**Body:**
If you're running local models with MCP support, this might be useful. MCPForge generates production-ready MCP servers from:

1. OpenAPI specs (JSON/YAML)
2. Plain English descriptions
3. API documentation URLs

Output is TypeScript or Python. Download the generated server and plug it into whatever MCP-compatible client you use.

The registry has pre-built servers you can browse and fork too.

Not locked to any provider — generates standard MCP servers that work anywhere.

[mcpforge-chi.vercel.app](https://mcpforge-chi.vercel.app)

---

## r/SideProject

**Title:** I built MCPForge — converts APIs to AI tool servers with one click

**Body:**
MCPForge generates MCP (Model Context Protocol) servers from OpenAPI specs, plain English, or API docs URLs. MCP is the open protocol that lets AI assistants like Claude call external tools.

**The problem:** Writing MCP servers involves a lot of boilerplate — parsing API specs, handling auth, formatting responses. For each new API, it's hours of work.

**The solution:** Paste your spec → preview the generated tools → download or deploy with one click.

Stack: Next.js 14, Turso, OpenAI for spec generation, Stripe billing. 310 tests.

Free tier available. Would love feedback!

[mcpforge-chi.vercel.app](https://mcpforge-chi.vercel.app)
