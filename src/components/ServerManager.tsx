'use client';

import { useState, useEffect, useCallback } from 'react';

interface ServerData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  language: string;
  toolCount: number;
  endpointUrl: string | null;
  healthStatus: string;
  autoRestart: boolean;
  visibility: string;
  uptime?: number;
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  createdAt: string;
}

interface EnvVar {
  id: string;
  key: string;
  isSecret: boolean;
  createdAt: string;
}

interface Version {
  id: string;
  versionNumber: number;
  toolCount: number;
  deployedAt: string | null;
  status: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

interface AnalyticsSummary {
  totalCalls: number;
  successRate: number;
  errorRate: number;
  avgLatencyMs: number;
}

interface TopTool {
  name: string;
  calls: number;
  avgLatencyMs: number;
  errors: number;
}

type Tab = 'overview' | 'logs' | 'env' | 'analytics' | 'versions' | 'settings';

export default function ServerManager({ serverId }: { serverId: string }) {
  const [server, setServer] = useState<ServerData | null>(null);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analytics, setAnalytics] = useState<{ summary: AnalyticsSummary; topTools: TopTool[] } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New env var form
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  const fetchServer = useCallback(async () => {
    try {
      const res = await fetch(`/api/servers/${serverId}`);
      if (!res.ok) throw new Error('Failed to load server');
      const data = await res.json();
      setServer(data.server);
      setEnvVars(data.envVars || []);
      setVersions(data.versions || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/servers/${serverId}/logs?limit=200`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch { /* ignore */ }
  }, [serverId]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/servers/${serverId}/analytics?period=7d`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics({ summary: data.summary, topTools: data.topTools });
      }
    } catch { /* ignore */ }
  }, [serverId]);

  useEffect(() => {
    fetchServer();
  }, [fetchServer]);

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
    if (activeTab === 'analytics') fetchAnalytics();
  }, [activeTab, fetchLogs, fetchAnalytics]);

  // Auto-refresh when viewing logs or overview
  useEffect(() => {
    if (activeTab === 'logs' || activeTab === 'overview') {
      const interval = setInterval(() => {
        fetchServer();
        if (activeTab === 'logs') fetchLogs();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchServer, fetchLogs]);

  async function handleAction(action: 'start' | 'stop' | 'restart') {
    setActionLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Action failed');
      }
      await fetchServer();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddEnv() {
    if (!newEnvKey || !newEnvValue) return;
    setError(null);
    try {
      const res = await fetch(`/api/servers/${serverId}/env`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars: [{ key: newEnvKey, value: newEnvValue, isSecret: true }] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add env var');
      }
      setNewEnvKey('');
      setNewEnvValue('');
      await fetchServer();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add env var');
    }
  }

  async function handleDeleteEnv(key: string) {
    setError(null);
    try {
      const res = await fetch(`/api/servers/${serverId}/env`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: [key] }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchServer();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete env var');
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure? This will permanently destroy this server and all its data.')) return;
    setError(null);
    try {
      const res = await fetch(`/api/servers/${serverId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete server');
      window.location.href = '/dashboard/servers';
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  function formatUptime(seconds?: number): string {
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/3" />
          <div className="h-48 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-400">Server not found</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'logs', label: 'Logs', icon: '📋' },
    { key: 'env', label: 'Environment', icon: '🔑' },
    { key: 'analytics', label: 'Analytics', icon: '📈' },
    { key: 'versions', label: 'Versions', icon: '📦' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  const statusColors: Record<string, string> = {
    running: 'bg-green-500',
    stopped: 'bg-gray-500',
    starting: 'bg-yellow-500',
    stopping: 'bg-yellow-500',
    error: 'bg-red-500',
    deploying: 'bg-blue-500',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-3 h-3 rounded-full ${statusColors[server.status] || 'bg-gray-500'} ${server.status === 'running' ? 'animate-pulse' : ''}`} />
            <h1 className="text-2xl font-bold">{server.name}</h1>
            <span className="text-sm text-gray-500 font-mono">{server.slug}</span>
          </div>
          {server.description && <p className="text-gray-400 text-sm">{server.description}</p>}
          {server.endpointUrl && (
            <p className="text-xs font-mono text-forge-400 mt-1">{server.endpointUrl}</p>
          )}
        </div>
        <div className="flex gap-2">
          {server.status === 'stopped' || server.status === 'error' ? (
            <button
              onClick={() => handleAction('start')}
              disabled={!!actionLoading}
              className="px-3 py-1.5 bg-green-900/50 hover:bg-green-800/50 border border-green-800 text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {actionLoading === 'start' ? '...' : '▶ Start'}
            </button>
          ) : server.status === 'running' ? (
            <>
              <button
                onClick={() => handleAction('restart')}
                disabled={!!actionLoading}
                className="px-3 py-1.5 bg-yellow-900/50 hover:bg-yellow-800/50 border border-yellow-800 text-yellow-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {actionLoading === 'restart' ? '...' : '🔄 Restart'}
              </button>
              <button
                onClick={() => handleAction('stop')}
                disabled={!!actionLoading}
                className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 border border-red-800 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {actionLoading === 'stop' ? '...' : '⏹ Stop'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-forge-500 text-forge-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className="text-lg font-semibold capitalize">{server.status}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Uptime</div>
              <div className="text-lg font-semibold">{formatUptime(server.uptime)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Tools</div>
              <div className="text-lg font-semibold">{server.toolCount}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Language</div>
              <div className="text-lg font-semibold capitalize">{server.language}</div>
            </div>
          </div>

          {/* Connection info */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold mb-3">Connect to this Server</h3>
            <p className="text-sm text-gray-400 mb-3">
              Use this endpoint in your MCP client (Claude Desktop, Cursor, etc.):
            </p>
            <div className="bg-black rounded-lg p-3 font-mono text-sm text-forge-400">
              {server.endpointUrl || 'Not deployed yet'}
            </div>
            <div className="mt-3 text-xs text-gray-500">
              <p>For Claude Desktop, add to <code className="text-gray-400">claude_desktop_config.json</code>:</p>
              <pre className="bg-black rounded-lg p-3 mt-2 overflow-x-auto text-gray-300">
{`{
  "mcpServers": {
    "${server.slug}": {
      "url": "${server.endpointUrl || 'https://...'}"
    }
  }
}`}
              </pre>
            </div>
          </div>

          {/* Recent versions */}
          {versions.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-3">Recent Deployments</h3>
              <div className="space-y-2">
                {versions.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">v{v.versionNumber} — {v.toolCount} tools</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        v.status === 'active' ? 'bg-green-900/50 text-green-400' :
                        v.status === 'failed' ? 'bg-red-900/50 text-red-400' :
                        'bg-gray-800 text-gray-400'
                      }`}>
                        {v.status}
                      </span>
                      {v.deployedAt && <span className="text-gray-500 text-xs">{new Date(v.deployedAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-black rounded-xl border border-gray-800 p-4 max-h-[600px] overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No logs yet</p>
          ) : (
            <div className="space-y-1">
              {logs.map((log, i) => {
                const levelColors: Record<string, string> = {
                  info: 'text-blue-400', error: 'text-red-400',
                  warn: 'text-yellow-400', debug: 'text-gray-500',
                };
                return (
                  <div key={i} className="flex gap-3">
                    <span className="text-gray-600 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`shrink-0 w-12 ${levelColors[log.level] || 'text-gray-400'}`}>
                      [{log.level}]
                    </span>
                    <span className="text-gray-300 break-all">{log.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'env' && (
        <div className="space-y-4">
          {/* Existing vars */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold mb-4">Environment Variables</h3>
            {envVars.length === 0 ? (
              <p className="text-gray-500 text-sm">No environment variables configured</p>
            ) : (
              <div className="space-y-2">
                {envVars.map((v) => (
                  <div key={v.id} className="flex items-center justify-between bg-black rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-forge-400">{v.key}</span>
                      {v.isSecret && <span className="text-gray-600 text-xs">••••••••</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteEnv(v.key)}
                      className="text-red-500 hover:text-red-400 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold mb-4">Add Variable</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="KEY_NAME"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                className="flex-1 bg-black border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:border-forge-500 focus:outline-none"
              />
              <input
                type="password"
                placeholder="value"
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                className="flex-1 bg-black border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:border-forge-500 focus:outline-none"
              />
              <button
                onClick={handleAddEnv}
                disabled={!newEnvKey || !newEnvValue}
                className="px-4 py-2 bg-forge-600 hover:bg-forge-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              Keys must be UPPER_SNAKE_CASE. Values are encrypted at rest. Server restarts automatically after changes.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {analytics ? (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Total Calls (7d)</div>
                  <div className="text-2xl font-bold">{analytics.summary.totalCalls.toLocaleString()}</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Success Rate</div>
                  <div className="text-2xl font-bold text-green-400">{analytics.summary.successRate}%</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Avg Latency</div>
                  <div className="text-2xl font-bold">{analytics.summary.avgLatencyMs}ms</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Error Rate</div>
                  <div className={`text-2xl font-bold ${analytics.summary.errorRate > 5 ? 'text-red-400' : 'text-gray-400'}`}>
                    {analytics.summary.errorRate}%
                  </div>
                </div>
              </div>

              {analytics.topTools.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="font-semibold mb-4">Top Tools</h3>
                  <div className="space-y-2">
                    {analytics.topTools.map((tool) => (
                      <div key={tool.name} className="flex items-center justify-between bg-black rounded-lg px-4 py-2.5">
                        <span className="font-mono text-sm text-gray-300">{tool.name}</span>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{tool.calls} calls</span>
                          <span>{tool.avgLatencyMs}ms avg</span>
                          {tool.errors > 0 && <span className="text-red-400">{tool.errors} errors</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <div className="text-4xl mb-4">📈</div>
              <p className="text-gray-400">Analytics data will appear once your server starts receiving tool calls</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'versions' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="font-semibold mb-4">Deployment History</h3>
          {versions.length === 0 ? (
            <p className="text-gray-500 text-sm">No versions yet</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between bg-black rounded-lg px-4 py-3">
                  <div>
                    <span className="font-semibold text-sm">Version {v.versionNumber}</span>
                    <span className="text-gray-500 text-sm ml-3">{v.toolCount} tools</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      v.status === 'active' ? 'bg-green-900/50 text-green-400 border border-green-800' :
                      v.status === 'failed' ? 'bg-red-900/50 text-red-400 border border-red-800' :
                      v.status === 'superseded' ? 'bg-gray-800 text-gray-500' :
                      'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
                    }`}>
                      {v.status}
                    </span>
                    {v.deployedAt && (
                      <span className="text-gray-500 text-xs">
                        {new Date(v.deployedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold mb-4">Server Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Server Name</label>
                <div className="text-sm">{server.name}</div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Slug</label>
                <div className="text-sm font-mono text-forge-400">{server.slug}</div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Auto-Restart</label>
                <div className="text-sm">{server.autoRestart ? 'Enabled' : 'Disabled'}</div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Visibility</label>
                <div className="text-sm capitalize">{server.visibility}</div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Created</label>
                <div className="text-sm text-gray-400">{new Date(server.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-5">
            <h3 className="font-semibold text-red-400 mb-2">Danger Zone</h3>
            <p className="text-sm text-gray-400 mb-4">
              Permanently delete this server and all its data, logs, and analytics. This cannot be undone.
            </p>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-900/50 hover:bg-red-800/50 border border-red-800 text-red-400 rounded-lg text-sm font-medium transition-colors"
            >
              Delete Server
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
