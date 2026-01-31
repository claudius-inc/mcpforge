import { redirect } from 'next/navigation';
import { getSession, getMonthlyUsage, getTierConfig } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';

async function getRecentGenerations(userId: string) {
  const db = getDb();
  await initDb();
  const result = await db.execute({
    sql: `SELECT id, type, spec_name, tool_count, language, created_at FROM generations WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    args: [userId],
  });
  return result.rows.map(r => ({
    id: r.id as string,
    type: r.type as string,
    specName: r.spec_name as string,
    toolCount: r.tool_count as number,
    language: r.language as string,
    createdAt: r.created_at as string,
  }));
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login?callbackUrl=/dashboard');

  const tier = getTierConfig(session.tier);
  const genCount = await getMonthlyUsage(session.id, 'generate');
  const composeCount = await getMonthlyUsage(session.id, 'compose');
  const describeCount = await getMonthlyUsage(session.id, 'describe');
  const recent = await getRecentGenerations(session.id);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Welcome back, {session.username}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-forge-950 border border-forge-800 text-forge-300">
          {tier.name} Plan
        </span>
      </div>

      {/* Usage Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <UsageCard
          label="Generations"
          used={genCount}
          limit={tier.limits.generationsPerMonth}
          icon="⚡"
        />
        <UsageCard
          label="AI Describes"
          used={describeCount}
          limit={tier.limits.aiDescribesPerMonth}
          icon="🧠"
        />
        <UsageCard
          label="Compositions"
          used={composeCount}
          limit={tier.limits.compositionsPerMonth}
          icon="🔀"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <a href="/generate" className="bg-gray-900 border border-gray-800 hover:border-forge-700 rounded-xl p-4 text-center transition-colors">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-sm font-medium">Generate Server</div>
        </a>
        <a href="/generate?tab=describe" className="bg-gray-900 border border-gray-800 hover:border-forge-700 rounded-xl p-4 text-center transition-colors">
          <div className="text-2xl mb-2">🧠</div>
          <div className="text-sm font-medium">AI Describe</div>
        </a>
        <a href="/generate?tab=compose" className="bg-gray-900 border border-gray-800 hover:border-forge-700 rounded-xl p-4 text-center transition-colors">
          <div className="text-2xl mb-2">🔀</div>
          <div className="text-sm font-medium">Compose APIs</div>
        </a>
        <a href="/generate?tab=crawl" className="bg-gray-900 border border-gray-800 hover:border-forge-700 rounded-xl p-4 text-center transition-colors">
          <div className="text-2xl mb-2">🔗</div>
          <div className="text-sm font-medium">Crawl Docs</div>
        </a>
        <a href="/dashboard/servers" className="bg-gray-900 border border-gray-800 hover:border-forge-700 rounded-xl p-4 text-center transition-colors">
          <div className="text-2xl mb-2">🖥️</div>
          <div className="text-sm font-medium">Hosted Servers</div>
        </a>
      </div>

      {session.tier === 'free' && (
        <div className="bg-gradient-to-r from-forge-950/50 to-blue-950/50 border border-forge-800/50 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">Unlock Pro Features</h3>
              <p className="text-gray-400 text-sm">Hosted servers, analytics, version history, and 10x more generations.</p>
            </div>
            <a href="/dashboard/billing" className="bg-forge-600 hover:bg-forge-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
              Upgrade — $29/mo
            </a>
          </div>
        </div>
      )}

      {/* Recent Generations */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold">Recent Generations</h2>
        </div>
        {recent.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <div className="text-3xl mb-2">⚡</div>
            <p>No generations yet. <a href="/generate" className="text-forge-400 hover:text-forge-300">Create your first MCP server →</a></p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {recent.map((gen) => (
              <div key={gen.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {gen.type === 'compose' ? '🔀' : gen.type === 'describe' ? '🧠' : gen.type === 'crawl' ? '🔗' : '⚡'}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{gen.specName || 'Untitled'}</p>
                    <p className="text-xs text-gray-500">
                      {gen.toolCount} tool{gen.toolCount !== 1 ? 's' : ''} · {gen.language} · {new Date(gen.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{gen.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UsageCard({ label, used, limit, icon }: { label: string; used: number; limit: number; icon: string }) {
  const pct = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);
  const isNearLimit = limit !== -1 && pct >= 80;
  const isAtLimit = limit !== -1 && used >= limit;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span>{icon}</span>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="flex items-end gap-1 mb-2">
        <span className={`text-2xl font-bold ${isAtLimit ? 'text-red-400' : 'text-white'}`}>{used}</span>
        <span className="text-gray-500 text-sm mb-0.5">/ {limit === -1 ? '∞' : limit}</span>
      </div>
      {limit !== -1 && (
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-forge-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {limit === -1 && <p className="text-xs text-gray-500">Unlimited</p>}
    </div>
  );
}
