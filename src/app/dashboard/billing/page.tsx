import { redirect } from 'next/navigation';
import { getSession, TIERS, type Tier } from '@/lib/auth';

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect('/login?callbackUrl=/dashboard/billing');

  const currentTier = TIERS[session.tier];
  const plans: { tier: Tier; config: typeof currentTier }[] = [
    { tier: 'free', config: TIERS.free },
    { tier: 'pro', config: TIERS.pro },
    { tier: 'team', config: TIERS.team },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-8">
        <a href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">← Dashboard</a>
        <h1 className="text-2xl font-bold mt-2">Billing</h1>
        <p className="text-gray-400 text-sm mt-1">
          Current plan: <span className="text-forge-400 font-medium">{currentTier.name}</span>
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {plans.map(({ tier, config }) => {
          const isCurrent = session.tier === tier;
          const isUpgrade = plans.findIndex(p => p.tier === tier) > plans.findIndex(p => p.tier === session.tier);
          
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
                {config.features.hostedDeploy && (
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="text-forge-400">✓</span>
                    {config.limits.hostedServers === -1 ? 'Unlimited' : config.limits.hostedServers} hosted servers
                  </li>
                )}
                {!config.features.hostedDeploy && (
                  <li className="flex items-center gap-2 text-gray-500">
                    <span>✗</span> No hosted servers
                  </li>
                )}
                <li className="flex items-center gap-2 text-gray-300">
                  <span className="text-forge-400">✓</span>
                  {config.limits.aiDescribesPerMonth === -1 ? 'Unlimited' : config.limits.aiDescribesPerMonth} AI describes/mo
                </li>
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

              {isCurrent ? (
                <button disabled className="w-full py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-500 cursor-not-allowed">
                  Current Plan
                </button>
              ) : isUpgrade ? (
                <button className="w-full py-2 rounded-lg text-sm font-medium bg-forge-600 hover:bg-forge-500 text-white transition-colors">
                  Upgrade to {config.name}
                </button>
              ) : (
                <button className="w-full py-2 rounded-lg text-sm font-medium border border-gray-700 text-gray-400 hover:border-gray-500 transition-colors">
                  Downgrade
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Billing Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold mb-4">Payment Method</h2>
        {session.tier === 'free' ? (
          <p className="text-gray-500 text-sm">
            No payment method on file. Add one when upgrading to Pro or Team.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-7 bg-gray-800 rounded flex items-center justify-center text-xs font-bold">
              VISA
            </div>
            <div>
              <p className="text-sm">•••• •••• •••• 4242</p>
              <p className="text-xs text-gray-500">Expires 12/2027</p>
            </div>
            <button className="ml-auto text-sm text-gray-400 hover:text-white transition-colors">
              Update
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
