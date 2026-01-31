import { TIERS, type Tier } from '@/lib/auth/tiers';

const PLAN_HIGHLIGHTS: Record<Tier, string[]> = {
  free: [
    '10 generations per month',
    '5 AI describes per month',
    '5 multi-API compositions per month',
    '1 API key',
    'Download as ZIP',
    'TypeScript + Python',
    'Community support',
  ],
  pro: [
    '100 generations per month',
    '50 AI describes per month',
    '50 compositions per month',
    '10 hosted MCP servers',
    '5 API keys',
    'Custom domains (slug.mcpforge.dev)',
    'Usage analytics dashboard',
    'Version history + migration guides',
    'Private servers',
    'Priority email support',
  ],
  team: [
    'Unlimited generations',
    'Unlimited AI describes',
    'Unlimited compositions',
    'Unlimited hosted servers',
    '20 API keys per member',
    'Custom domains',
    'Full analytics',
    'Team management + roles',
    'Private servers',
    'Priority support + Slack channel',
    'SSO (coming soon)',
  ],
};

export default function PricingPage() {
  const plans = [
    { tier: 'free' as Tier, cta: 'Get Started Free', ctaHref: '/generate' },
    { tier: 'pro' as Tier, cta: 'Start Pro Trial', ctaHref: '/login?callbackUrl=/dashboard/billing', popular: true },
    { tier: 'team' as Tier, cta: 'Contact Us', ctaHref: 'mailto:team@mcpforge.dev' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Start free. Upgrade when you need hosted servers, analytics, or higher limits.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-16">
        {plans.map(({ tier, cta, ctaHref, popular }) => {
          const config = TIERS[tier];
          return (
            <div
              key={tier}
              className={`rounded-2xl border p-8 ${
                popular
                  ? 'bg-gray-900 border-forge-600 ring-1 ring-forge-600/30 relative'
                  : 'bg-gray-900 border-gray-800'
              }`}
            >
              {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium bg-forge-600 text-white">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-bold">{config.name}</h2>
                <div className="mt-3">
                  <span className="text-4xl font-bold">${config.price}</span>
                  {config.price > 0 && <span className="text-gray-400">/month</span>}
                </div>
                {config.price === 0 && <p className="text-gray-500 text-sm mt-1">No credit card required</p>}
              </div>

              <a
                href={ctaHref}
                className={`block text-center py-3 rounded-lg font-medium transition-colors mb-8 ${
                  popular
                    ? 'bg-forge-600 hover:bg-forge-500 text-white'
                    : 'border border-gray-700 hover:border-gray-500 text-gray-300'
                }`}
              >
                {cta}
              </a>

              <ul className="space-y-3">
                {PLAN_HIGHLIGHTS[tier].map(feature => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <span className="text-forge-400 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">FAQ</h2>
        <div className="space-y-6">
          {[
            {
              q: 'Can I use generated servers commercially?',
              a: 'Yes. All generated code is yours — MIT licensed. Use it however you want.',
            },
            {
              q: 'What are "hosted servers"?',
              a: 'Pro and Team plans let you deploy MCP servers directly on MCPForge infrastructure. No Docker, no VPS — just click deploy and get a URL your AI can connect to.',
            },
            {
              q: 'Can I self-host instead?',
              a: 'Absolutely. Every generated server includes a Dockerfile and deployment instructions. Self-hosting is always free.',
            },
            {
              q: 'Do you offer annual billing?',
              a: 'Coming soon. Annual plans will include 2 months free.',
            },
            {
              q: 'What counts as a "generation"?',
              a: 'Each time you download a ZIP (from generate, compose, or version update) counts as one generation. Previewing tools is free and unlimited.',
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="font-semibold mb-2">{q}</h3>
              <p className="text-gray-400 text-sm">{a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-16 py-12 border-t border-gray-800">
        <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
        <a
          href="/generate"
          className="bg-forge-600 hover:bg-forge-500 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors inline-block"
        >
          Generate Your First Server →
        </a>
      </div>
    </div>
  );
}
