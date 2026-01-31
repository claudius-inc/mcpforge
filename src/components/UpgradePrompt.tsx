'use client';

import { useSession } from 'next-auth/react';

interface UpgradePromptProps {
  feature: string;
  requiredTier: 'pro' | 'team';
}

export function UpgradePrompt({ feature, requiredTier }: UpgradePromptProps) {
  const { data: session } = useSession();

  return (
    <div className="bg-gradient-to-r from-forge-950 to-blue-950 border border-forge-800 rounded-xl p-6 text-center">
      <div className="text-3xl mb-3">🔒</div>
      <h3 className="text-lg font-semibold mb-2">
        {feature} requires {requiredTier === 'pro' ? 'Pro' : 'Team'}
      </h3>
      <p className="text-gray-400 text-sm mb-4">
        {requiredTier === 'pro'
          ? 'Upgrade to Pro for hosted servers, analytics, version history, and 100 generations/month.'
          : 'Upgrade to Team for unlimited everything, team management, and priority support.'}
      </p>
      <div className="flex gap-3 justify-center">
        {session ? (
          <a
            href="/dashboard/billing"
            className="bg-forge-600 hover:bg-forge-500 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            Upgrade to {requiredTier === 'pro' ? 'Pro — $29/mo' : 'Team — $99/mo'}
          </a>
        ) : (
          <a
            href="/login?callbackUrl=/dashboard/billing"
            className="bg-forge-600 hover:bg-forge-500 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            Sign in to Upgrade
          </a>
        )}
        <a
          href="/pricing"
          className="border border-gray-700 hover:border-gray-500 text-gray-300 px-6 py-2 rounded-lg text-sm transition-colors"
        >
          Compare Plans
        </a>
      </div>
    </div>
  );
}

export function UsageBadge({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);
  const isNearLimit = limit !== -1 && pct >= 80;
  const isAtLimit = limit !== -1 && used >= limit;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        <span className={`text-sm font-medium ${isAtLimit ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-gray-300'}`}>
          {used} / {limit === -1 ? '∞' : limit}
        </span>
      </div>
      {limit !== -1 && (
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-forge-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
