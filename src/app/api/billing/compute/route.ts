import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getComputeBilling } from '@/lib/billing';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const billing = await getComputeBilling(session.id, session.tier);

  return NextResponse.json({
    period: billing.period,
    tier: billing.tier,
    compute: {
      totalMinutes: billing.totalMinutes,
      includedMinutes: billing.includedMinutes,
      overage: billing.overage,
      overageCost: billing.overageCost,
      servers: billing.servers.map(s => ({
        id: s.serverId,
        name: s.serverName,
        minutes: s.uptimeMinutes,
        cost: Math.round(s.cost * 100) / 100,
      })),
    },
  });
}
