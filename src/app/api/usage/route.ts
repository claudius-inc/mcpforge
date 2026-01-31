import { NextResponse } from 'next/server';
import { getSession, getMonthlyUsage, getTierConfig } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tier = getTierConfig(session.tier);
  const [generates, describes, composes] = await Promise.all([
    getMonthlyUsage(session.id, 'generate'),
    getMonthlyUsage(session.id, 'describe'),
    getMonthlyUsage(session.id, 'compose'),
  ]);

  return NextResponse.json({
    tier: session.tier,
    tierName: tier.name,
    usage: {
      generates: { used: generates, limit: tier.limits.generationsPerMonth },
      describes: { used: describes, limit: tier.limits.aiDescribesPerMonth },
      composes: { used: composes, limit: tier.limits.compositionsPerMonth },
    },
    features: tier.features,
  });
}
