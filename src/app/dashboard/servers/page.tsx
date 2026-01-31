import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, getTierConfig } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';
import { hasFeature, checkLimit } from '@/lib/auth/tiers';

interface ServerRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  language: string;
  tool_count: number;
  endpoint_url: string | null;
  health_status: string;
  auto_restart: number;
  visibility: string;
  created_at: string;
  updated_at: string;
}

async function getServers(userId: string): Promise<ServerRow[]> {
  const db = getDb();
  await initDb();
  const result = await db.execute({
    sql: `SELECT id, name, slug, description, status, language, tool_count,
          endpoint_url, health_status, auto_restart, visibility, created_at, updated_at
          FROM servers WHERE user_id = ? ORDER BY created_at DESC`,
    args: [userId],
  });
  return result.rows as unknown as ServerRow[];
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-green-900/50 text-green-400 border-green-800',
    stopped: 'bg-gray-900/50 text-gray-400 border-gray-700',
    starting: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    stopping: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    error: 'bg-red-900/50 text-red-400 border-red-800',
    deploying: 'bg-blue-900/50 text-blue-400 border-blue-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status] || colors.stopped}`}>
      {status}
    </span>
  );
}

function LanguageBadge({ language }: { language: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
      language === 'typescript' ? 'bg-blue-900/30 text-blue-400' : 'bg-yellow-900/30 text-yellow-400'
    }`}>
      {language === 'typescript' ? 'TS' : 'PY'}
    </span>
  );
}

export default async function ServersPage() {
  const session = await getSession();
  if (!session) redirect('/login?callbackUrl=/dashboard/servers');

  const tier = getTierConfig(session.tier);
  const servers = await getServers(session.id);
  const canDeploy = hasFeature(session.tier, 'hostedDeploy');
  const limitCheck = checkLimit(session.tier, 'hostedServers', servers.length);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Hosted Servers</h1>
          <p className="text-gray-400 text-sm mt-1">
            {servers.length} server{servers.length !== 1 ? 's' : ''}
            {limitCheck.limit > 0 && ` / ${limitCheck.limit} limit`}
          </p>
        </div>
        {canDeploy && limitCheck.allowed && (
          <Link
            href="/generate?deploy=true"
            className="px-4 py-2 bg-gradient-to-r from-forge-600 to-forge-500 hover:from-forge-500 hover:to-forge-400 text-white rounded-lg text-sm font-medium transition-all"
          >
            + Deploy New Server
          </Link>
        )}
      </div>

      {/* Upgrade prompt for free tier */}
      {!canDeploy && (
        <div className="bg-gradient-to-r from-forge-950 to-gray-900 border border-forge-800 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-forge-300 mb-2">🚀 Host Your MCP Servers</h3>
          <p className="text-gray-400 text-sm mb-4">
            Deploy generated MCP servers with one click. Get endpoints your AI agents can connect to instantly.
            Includes health monitoring, auto-restart, environment management, and usage analytics.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-block px-4 py-2 bg-forge-600 hover:bg-forge-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Upgrade to Pro →
          </Link>
        </div>
      )}

      {/* Server list */}
      {servers.length === 0 && canDeploy ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">🖥️</div>
          <h3 className="text-lg font-semibold mb-2">No servers yet</h3>
          <p className="text-gray-400 text-sm mb-6">
            Generate an MCP server from an OpenAPI spec, then deploy it here with one click.
          </p>
          <Link
            href="/generate"
            className="inline-block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Generate a Server →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => (
            <Link
              key={server.id}
              href={`/dashboard/servers/${server.id}`}
              className="block bg-gray-900 border border-gray-800 hover:border-forge-700 rounded-xl p-5 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold truncate">{server.name}</h3>
                    <StatusBadge status={server.status} />
                    <LanguageBadge language={server.language} />
                    {server.visibility === 'public' && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-900/30 text-purple-400">public</span>
                    )}
                  </div>
                  {server.description && (
                    <p className="text-gray-400 text-sm truncate mb-2">{server.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{server.tool_count} tool{server.tool_count !== 1 ? 's' : ''}</span>
                    {server.endpoint_url && (
                      <span className="font-mono truncate max-w-[300px]">{server.endpoint_url}</span>
                    )}
                    <span>{server.slug}</span>
                  </div>
                </div>
                <div className="text-gray-500 ml-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
