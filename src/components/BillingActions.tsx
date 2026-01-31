'use client';

import { useState } from 'react';
import type { Tier } from '@/lib/auth/tiers';

interface BillingActionsProps {
  currentTier: Tier;
  targetTier: Tier;
  tierName: string;
}

export function UpgradeButton({ currentTier, targetTier, tierName }: BillingActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUpgrade = tierRank(targetTier) > tierRank(currentTier);
  const isDowngrade = tierRank(targetTier) < tierRank(currentTier);
  const isCurrent = currentTier === targetTier;

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetTier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      if (data.url) window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleManage() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open billing portal');
      if (data.url) window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (isCurrent) {
    return (
      <button disabled className="w-full py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-500 cursor-not-allowed">
        Current Plan
      </button>
    );
  }

  return (
    <div>
      {isUpgrade ? (
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full py-2 rounded-lg text-sm font-medium bg-forge-600 hover:bg-forge-500 text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {loading ? 'Redirecting...' : `Upgrade to ${tierName}`}
        </button>
      ) : isDowngrade ? (
        <button
          onClick={handleManage}
          disabled={loading}
          className="w-full py-2 rounded-lg text-sm font-medium border border-gray-700 text-gray-400 hover:border-gray-500 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Downgrade'}
        </button>
      ) : null}
      {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
    </div>
  );
}

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function handlePortal() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePortal}
      disabled={loading}
      className="text-sm text-forge-400 hover:text-forge-300 transition-colors disabled:opacity-50"
    >
      {loading ? 'Loading...' : 'Manage Subscription →'}
    </button>
  );
}

export function CancelSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel? You\'ll lose access to Pro features at the end of your billing period.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      const data = await res.json();
      if (data.success) window.location.reload();
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
    >
      {loading ? 'Cancelling...' : 'Cancel Subscription'}
    </button>
  );
}

function tierRank(tier: Tier): number {
  return tier === 'free' ? 0 : tier === 'pro' ? 1 : 2;
}
