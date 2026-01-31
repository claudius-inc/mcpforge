import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDb, initDb } from '@/lib/db';
import type { Tier } from '@/lib/auth/tiers';

const PLAN_MAP: Record<string, Tier> = {
  [process.env.STRIPE_PRO_PRICE_ID || 'price_pro']: 'pro',
  [process.env.STRIPE_TEAM_PRICE_ID || 'price_team']: 'team',
};

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '');
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const db = getDb();
  await initDb();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const subscriptionId = session.subscription as string;
      if (userId && subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price?.id || '';
        const tier = PLAN_MAP[priceId] || 'pro';
        await db.execute({
          sql: `UPDATE users SET tier = ?, stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = ?`,
          args: [tier, subscriptionId, userId],
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id || '';
      const tier = PLAN_MAP[priceId] || 'free';
      const customerId = sub.customer as string;
      
      if (sub.status === 'active') {
        await db.execute({
          sql: `UPDATE users SET tier = ?, stripe_subscription_id = ?, updated_at = datetime('now') WHERE stripe_customer_id = ?`,
          args: [tier, sub.id, customerId],
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      await db.execute({
        sql: `UPDATE users SET tier = 'free', stripe_subscription_id = NULL, updated_at = datetime('now') WHERE stripe_customer_id = ?`,
        args: [customerId],
      });
      break;
    }

    case 'invoice.payment_failed': {
      console.warn('Payment failed:', event.data.object);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
