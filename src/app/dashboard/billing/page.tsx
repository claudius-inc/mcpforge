import { redirect } from 'next/navigation';
import { getSession, TIERS, type Tier } from '@/lib/auth';
import { getComputeBilling, getIncludedMinutes, getOverageRate } from '@/lib/billing';
import { UpgradeButton, ManageSubscriptionButton, CancelSubscriptionButton } from '@/components/BillingActions';
import { BillingSuccessBanner } from '@/components/BillingBanners';

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect('/login?callbackUrl=/dashboard/billing');

  const currentTier = TIERS[session.tier];
  const compute = await getComputeBilling(session.id, session.tier);
  const plans: { tier: Tier; config: typeof currentTier }[] = [
    { tier: 'free', config: TIERS.free },
    { tier: 'pro', config: TIERS.pro },
    { tier: 'team', config: TIERS.team },
  ];

  const hasPaidPlan = session.tier !== 'free';
  const computePct = compute.includedMinutes > 0
    ? Math.min(100, (compute.totalMinutes / compute.includedMinutes) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-8">
        <a href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">← Dashboard</a>
        <h1 className="text-2xl font-bold mt-2">Billing</h1>
        <p className="text-gray-400 text-sm mt-1">
          Current plan: <span className="text-forge-400 font-medium">{currentTier.name}</span>
        </p>
      </div>

      {/* Success/Cancel banners */}
      <BillingSuccessBanner />

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {plans.map(({ tier, config }) => {
          const isCurrent = session.tier === tier;

          return (
            <div
              key={tier}
              className={`rounded-2xl border p-6 ${
                isCurrent
                  ? 'bg-forge-950/30 border-forge-700'
                  : tier === 'pro'
                  ? 'bg-gray-900 border-gray-700'
                  : 'bg-gray-900 border-gray-800'
              }`}
            >
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{config.name}</h3>
                  {isCurrent && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-forge-900 text-forge-300">Current</span>
                  )}
                  {tier === 'pro' && !isCurrent && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300">Popular</span>
                  )}
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold">${config.price}</span>
                  {config.price > 0 && <span className="text-gray-400 text-sm">/month</span>}
                </div>
              </div>

              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2 text-gray-300">
                  <span className="text-forge-400">✓</span>
                  {config.limits.generationsPerMonth === -1 ? 'Unlimited' : config.limits.generationsPerMonth} generations/mo
                </li>
                {config.features.hostedDeploy ? (
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="text-forge-400">✓</span>
                    {config.limits.hostedServers === -1 ? 'Unlimited' : config.limits.hostedServers} hosted servers
                  </li>
                ) : (
                  <li className="flex items-center gap-2 text-gray-500">
                    <span>✗</span> No hosted servers
                  </li>
                )}
                <li className="flex items-center gap-2 text-gray-300">
                  <span className="text-forge-400">✓</span>
                  {config.limits.aiDescribesPerMonth === -1 ? 'Unlimited' : config.limits.aiDescribesPerMonth} AI describes/mo
                </li>
                {config.features.hostedDeploy && (
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="text-forge-400">✓</span>
                    {formatMinutes(getIncludedMinutes(tier))} compute included
                  </li>
                )}
                {config.features.analytics && (
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="text-forge-400">✓</span> Usage analytics
                  </li>
                )}
                {config.features.customDomains && (
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="text-forge-400">✓</span> Custom domains
                  </li>
                )}
                {config.features.versionHistory && (
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="text-forge-400">✓</span> Version history
                  </li>
                )}
                {config.features.teamManagement && (
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="text-forge-400">✓</span> Team management
                  </li>
                )}
                {config.features.prioritySupport && (
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="text-forge-400">✓</span> Priority support
                  </li>
                )}
              </ul>

              <UpgradeButton currentTier={session.tier} targetTier={tier} tierName={config.name} />
            </div>
          );
        })}
      </div>

      {/* Compute Usage */}
      {hasPaidPlan && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="font-semibold mb-4">Compute Usage</h2>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-gray-400 text-xs mb-1">Used this period</p>
              <p className="text-xl font-bold">{formatMinutes(compute.totalMinutes)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Included</p>
              <p className="text-xl font-bold text-gray-300">{formatMinutes(compute.includedMinutes)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Overage</p>
              <p className={`text-xl font-bold ${compute.overageCost > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                {compute.overage > 0 ? `${formatMinutes(compute.overage)} ($${compute.overageCost.toFixed(2)})` : 'None'}
              </p>
            </div>
          </div>
          {compute.includedMinutes > 0 && (
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${computePct >= 90 ? 'bg-red-500' : computePct >= 70 ? 'bg-yellow-500' : 'bg-forge-500'}`}
                style={{ width: `${Math.min(100, computePct)}%` }}
              />
            </div>
          )}
          {compute.servers.length > 0 ? (
            <div className="divide-y divide-gray-800 mt-4">
              {compute.servers.map(s => (
                <div key={s.serverId} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{s.serverName}</p>
                    <p className="text-xs text-gray-500">{formatMinutes(s.uptimeMinutes)} uptime</p>
                  </div>
                  {s.cost > 0 && (
                    <span className="text-xs text-yellow-400">${s.cost.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No server usage this period</p>
          )}
          <p className="text-gray-600 text-xs mt-3">
            Overage rate: ${getOverageRate()}/min (${(getOverageRate() * 60).toFixed(2)}/hr)
          </p>
        </div>
      )}

      {/* Subscription Management */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold mb-4">Subscription</h2>
        {hasPaidPlan ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">
                  <span className="text-forge-400 font-medium">{currentTier.name}</span> plan — ${currentTier.price}/month
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Manage your subscription, update payment method, or view invoices.
                </p>
              </div>
              <ManageSubscriptionButton />
            </div>
            <div className="border-t border-gray-800 pt-4 flex justify-end">
              <CancelSubscriptionButton />
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            No active subscription. Upgrade to Pro or Team to unlock hosted servers, analytics, and more.
          </p>
        )}
      </div>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}
