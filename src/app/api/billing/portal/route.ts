import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '');
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  await initDb();
  const result = await db.execute({
    sql: 'SELECT stripe_customer_id FROM users WHERE id = ?',
    args: [session.id],
  });

  const customerId = result.rows[0]?.stripe_customer_id as string | null;
  if (!customerId) {
    return NextResponse.json({ error: 'No billing account found. Subscribe to a plan first.' }, { status: 400 });
  }

  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
