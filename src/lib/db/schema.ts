// Database schema for MCPForge — Users, Sessions, Generations, Subscriptions

export const SCHEMA_SQL = `
-- Users table (GitHub OAuth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  username TEXT NOT NULL,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  tier TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- NextAuth sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TEXT NOT NULL
);

-- NextAuth accounts (OAuth providers)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  UNIQUE(provider, provider_account_id)
);

-- Generation history (tracks usage for tier limits)
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  type TEXT NOT NULL DEFAULT 'generate',
  spec_name TEXT,
  tool_count INTEGER DEFAULT 0,
  language TEXT DEFAULT 'typescript',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT 'default',
  scopes TEXT NOT NULL DEFAULT 'generate',
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hosted MCP servers
CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'stopped',
  language TEXT NOT NULL DEFAULT 'typescript',
  spec_snapshot TEXT,
  tool_count INTEGER DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'docker',
  provider_id TEXT,
  endpoint_url TEXT,
  health_status TEXT DEFAULT 'unknown',
  health_checked_at TEXT,
  last_started_at TEXT,
  last_stopped_at TEXT,
  auto_restart INTEGER NOT NULL DEFAULT 1,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Server environment variables (encrypted at rest in production)
CREATE TABLE IF NOT EXISTS server_env_vars (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  is_secret INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(server_id, key)
);

-- Server logs (execution + health check logs)
CREATE TABLE IF NOT EXISTS server_logs (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Server usage analytics (tool call tracking)
CREATE TABLE IF NOT EXISTS server_analytics (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  latency_ms INTEGER,
  error_message TEXT,
  caller_info TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Server versions (deployment history)
CREATE TABLE IF NOT EXISTS server_versions (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  spec_snapshot TEXT NOT NULL,
  tool_count INTEGER DEFAULT 0,
  deployed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  rollback_of TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Compute usage tracking (server uptime for billing)
CREATE TABLE IF NOT EXISTS compute_usage (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  billed INTEGER NOT NULL DEFAULT 0,
  stripe_usage_record_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_generations_user ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_anon ON generations(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_servers_user ON servers(user_id);
CREATE INDEX IF NOT EXISTS idx_servers_slug ON servers(slug);
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_server_env_server ON server_env_vars(server_id);
CREATE INDEX IF NOT EXISTS idx_server_logs_server ON server_logs(server_id);
CREATE INDEX IF NOT EXISTS idx_server_logs_created ON server_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_server_analytics_server ON server_analytics(server_id);
CREATE INDEX IF NOT EXISTS idx_server_analytics_created ON server_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_server_versions_server ON server_versions(server_id);
CREATE INDEX IF NOT EXISTS idx_compute_usage_user ON compute_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_compute_usage_server ON compute_usage(server_id);
CREATE INDEX IF NOT EXISTS idx_compute_usage_period ON compute_usage(start_time, end_time);
`;
