import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';

// Stripe price IDs (set in env)
const PRICE_IDS: Record<string, string> = {
  pro: process.env.STRIPE_PRO_PRICE_ID || '',
  team: process.env.STRIPE_TEAM_PRICE_ID || '',
};

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '');
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stripe = getStripe();
  const body = await req.json();
  const plan = body.plan as string;

  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json({ error: 'Invalid plan. Choose "pro" or "team".' }, { status: 400 });
  }

  if (plan === session.tier) {
    return NextResponse.json({ error: 'Already on this plan' }, { status: 400 });
  }

  // Don't allow "upgrading" to free
  if (plan === 'free') {
    return NextResponse.json({ error: 'Use the cancel endpoint to downgrade to free' }, { status: 400 });
  }

  const db = getDb();
  await initDb();
  const userResult = await db.execute({
    sql: 'SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?',
    args: [session.id],
  });
  let customerId = userResult.rows[0]?.stripe_customer_id as string | null;
  const existingSubId = userResult.rows[0]?.stripe_subscription_id as string | null;

  // Create Stripe customer if needed
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.email || undefined,
      metadata: { userId: session.id, username: session.username },
    });
    customerId = customer.id;
    await db.execute({
      sql: 'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
      args: [customerId, session.id],
    });
  }

  // If user has an existing subscription, handle plan change via subscription update
  if (existingSubId && session.tier !== 'free') {
    try {
      const sub = await stripe.subscriptions.retrieve(existingSubId);
      if (sub.status === 'active' || sub.status === 'trialing') {
        // Prorate and switch plan immediately
        await stripe.subscriptions.update(existingSubId, {
          items: [{
            id: sub.items.data[0].id,
            price: PRICE_IDS[plan],
          }],
          proration_behavior: 'create_prorations',
          metadata: { userId: session.id, plan },
        });

        return NextResponse.json({
          success: true,
          message: `Plan changed to ${plan}. Prorated charges apply.`,
          redirect: '/dashboard/billing?success=true',
        });
      }
    } catch {
      // Subscription retrieval failed — fall through to new checkout
    }
  }

  // Create new checkout session
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/billing?canceled=true`,
    allow_promotion_codes: true,
    metadata: { userId: session.id, plan },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
