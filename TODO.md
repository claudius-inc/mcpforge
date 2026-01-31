# MCPForge — TODO

## Phase 1: Core Engine — OpenAPI → MCP Server Generation ✅
- [x] Project scaffolding (Next.js 14, TypeScript, Tailwind, @libsql/client)
- [x] OpenAPI 3.0/3.1 spec parser (extract endpoints, schemas, auth, descriptions)
- [x] MCP server code generator — TypeScript target (using @modelcontextprotocol/sdk)
- [x] MCP server code generator — Python target (using mcp Python SDK)
- [x] Tool mapping engine: REST endpoints → MCP tools (name, description, input schema, handler)
- [x] Auth translation: API key, Bearer token, OAuth2 → MCP server env config
- [x] Generated code output: downloadable .zip with README, package.json/pyproject.toml, server code
- [x] Basic web UI: paste/upload OpenAPI spec → preview generated tools → download
- [x] Test suite: 86 tests (parser 18, mapper 20, generator 37, e2e+zip 11). All green.

## Phase 2: Hosted MCP Servers
- [ ] Server deployment pipeline (containerized MCP servers on Fly.io or Railway)
- [ ] Server management dashboard (start/stop/logs/config)
- [ ] Environment variable management (API keys, secrets)
- [ ] Health monitoring + auto-restart
- [ ] Custom MCP server URLs (slug.mcpforge.dev)
- [ ] Usage analytics (tool calls, latency, error rates)

## Phase 3: Smart Features
- [x] Tool testing playground (call tools directly in browser) — server-side proxy, dynamic forms, cURL preview, response viewer
- [x] Plain English → MCP server (describe what you want, AI generates the spec + server)
- [x] API documentation crawler (point at docs URL → auto-extract endpoints → generate) — HTML extraction, SSRF protection, AI spec generation, auto-detect raw specs
- [x] Multi-API composition (combine multiple APIs into one MCP server) — composer library, /api/compose endpoint, ComposeMultiple UI, per-API prefixing, 19 tests
- [x] Version management — spec differ, compareVersions E2E, /api/version endpoint (diff + download modes), VersionManager UI component, MIGRATION.md auto-generation, backwards-compatibility detection, 23 tests

## Phase 4: Monetization
- [ ] GitHub OAuth login
- [ ] Free tier: 2 generated servers (download only)
- [ ] Pro tier ($29/mo): 10 hosted servers, custom domains, analytics
- [ ] Team tier ($99/mo): unlimited servers, team management, priority support
- [ ] Stripe billing integration
- [ ] Usage-based pricing for hosted server compute

## Phase 5: Community & Growth
- [ ] Public MCP server registry (discover + one-click deploy community servers)
- [ ] "Fork" existing servers (customize community servers)
- [ ] GitHub integration (commit generated servers to repo)
- [ ] CLI tool: `mcpforge generate openapi.yaml` (local generation)
- [ ] VS Code extension
