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
    sql: 'SELECT stripe_subscription_id FROM users WHERE id = ?',
    args: [session.id],
  });

  const subscriptionId = result.rows[0]?.stripe_subscription_id as string | null;
  if (!subscriptionId) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
  }

  const stripe = getStripe();
  // Cancel at period end (user keeps access until billing period ends)
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  return NextResponse.json({ success: true, message: 'Subscription will cancel at end of billing period' });
}
