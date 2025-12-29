import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase client
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
} catch (error) {
  console.log('Supabase not configured');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Get raw body for webhook verification
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const rawBody = Buffer.from(body);
    
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_email;
    
    // Update subscription in Supabase if configured
    if (supabase && customerEmail) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', customerEmail)
          .single();

        if (profile) {
          // Deactivate old subscriptions
          await supabase
            .from('subscriptions')
            .update({ status: 'inactive' })
            .eq('user_id', profile.id)
            .eq('status', 'active');

          // Create new subscription
          await supabase
            .from('subscriptions')
            .insert({
              user_id: profile.id,
              plan_type: session.metadata?.plan || 'BUYER_PACK',
              status: 'active',
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription
            });
        }
      } catch (error) {
        console.error('Supabase subscription update error:', error);
      }
    }
  }

  res.json({ received: true });
}

