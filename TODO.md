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

## Phase 2: Hosted MCP Servers ✅
- [x] Server deployment pipeline — DeploymentProvider abstraction (Docker local, Fly.io/Railway stubs), process-based server management, TS+Python scaffolding
- [x] Server management dashboard — list page with status badges, detail page with 6-tab ServerManager (overview, logs, env, analytics, versions, settings)
- [x] Environment variable management — secure CRUD API, UPPER_SNAKE_CASE validation, hot-reload on change, secret masking in API responses
- [x] Health monitoring + auto-restart — health check interface, auto-restart on crash with 5s backoff, status tracking in DB
- [x] Custom MCP server URLs (slug-based: `{name}-{userId}` format, unique enforcement)
- [x] Usage analytics — tool call tracking, success/error rates, latency stats, top tools, daily breakdown, per-period filtering (1d/7d/30d)
- [ ] Cloud deployment (Fly.io/Railway) — needs external accounts, Docker provider works locally

## Phase 3: Smart Features
- [x] Tool testing playground (call tools directly in browser) — server-side proxy, dynamic forms, cURL preview, response viewer
- [x] Plain English → MCP server (describe what you want, AI generates the spec + server)
- [x] API documentation crawler (point at docs URL → auto-extract endpoints → generate) — HTML extraction, SSRF protection, AI spec generation, auto-detect raw specs
- [x] Multi-API composition (combine multiple APIs into one MCP server) — composer library, /api/compose endpoint, ComposeMultiple UI, per-API prefixing, 19 tests
- [x] Version management — spec differ, compareVersions E2E, /api/version endpoint (diff + download modes), VersionManager UI component, MIGRATION.md auto-generation, backwards-compatibility detection, 23 tests

## Phase 4: Monetization ✅
- [x] GitHub OAuth login — NextAuth + GitHub provider, JWT sessions, DB user upsert
- [x] Free tier: 10 generations/mo, 5 AI describes, 5 compositions, 1 API key, download only
- [x] Pro tier ($29/mo): 100 gens, 50 describes, 50 compositions, 10 hosted servers, analytics, custom domains, version history
- [x] Team tier ($99/mo): unlimited everything, team management, priority support, 20 API keys
- [x] Stripe billing integration — checkout, webhook (subscription lifecycle), customer portal, cancel endpoint
- [x] Interactive billing page — upgrade/downgrade buttons, success/cancel banners, subscription management
- [x] Usage-based compute pricing — per-server uptime tracking, included minutes (Pro 10k, Team 100k), overage at $0.005/min
- [x] 33 billing tests (tiers, limits, features, compute pricing, schema validation)

## Phase 5: Community & Growth
- [x] Public MCP server registry (discover + one-click deploy community servers) — browse/search UI with categories/tags/sorting/pagination, publish API, listing detail page with download/Claude config
- [x] "Fork" existing servers (customize community servers) — fork API + UI button, creates new listing linked to source
- [x] GitHub integration (commit generated servers to repo) — /api/github/push endpoint, creates/pushes repos using user's OAuth token
- [x] CLI tool: `mcpforge generate openapi.yaml` (local generation) — full CLI with generate/describe/search/info commands, local + API fallback
- [x] VS Code extension — generate from spec, describe, registry search, CodeLens for OpenAPI files

## Phase 6: Polish & Launch
- [x] Enhanced SEO metadata — OG/Twitter cards, canonical URL, robots directives, template-based titles
- [x] OG image API route (/api/og) — edge runtime, dynamic title/subtitle, gradient design with branding
- [x] Landing page polish — hero gradient glow, stats bar, "Built for Every Workflow" use cases section
- [x] Seed registry data — 10 curated OpenAPI specs (OpenWeather, GitHub, Stripe, HN, JSONPlaceholder, NASA, ExchangeRate, NewsAPI, Spotify, SendGrid), 44 tools, 5 featured
- [x] Launch content — Reddit r/SideProject, r/webdev, Product Hunt, Show HN posts (written Phase 5)
- [x] Deploy to production (Vercel + Turso + Stripe) — ✅ LIVE
- [x] /api/health endpoint — DB connectivity, env validation, uptime/latency reporting
- [x] Set up production analytics and monitoring (Vercel Analytics + Speed Insights)
- [ ] Cloud deployment providers (Fly.io/Railway) — needs external accounts
