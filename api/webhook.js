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
    const planType = session.metadata?.plan || 'STARTER_PACK';
    
    console.log('[Webhook] Processing payment:', { customerEmail, planType, sessionId: session.id });
    
    // Update subscription and credits in Supabase if configured
    if (supabase && customerEmail) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', customerEmail)
          .single();

        if (profile) {
          console.log('[Webhook] Found profile:', { userId: profile.id, currentCredits: profile.credit_topups });
          
          // Deactivate old subscriptions
          await supabase
            .from('subscriptions')
            .update({ status: 'inactive' })
            .eq('user_id', profile.id)
            .eq('status', 'active');

          // Create new subscription record
          await supabase
            .from('subscriptions')
            .insert({
              user_id: profile.id,
              plan_type: planType,
              status: 'active',
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              stripe_session_id: session.id
            });

          // Add credits based on plan type
          if (planType === 'STARTER_PACK') {
            const newCredits = (profile.credit_topups || 0) + 3;
            await supabase
              .from('profiles')
              .update({ credit_topups: newCredits, updated_at: new Date().toISOString() })
              .eq('id', profile.id);
            console.log('[Webhook] Added 3 credits for STARTER_PACK:', newCredits);
          } else if (planType === 'BULK_PACK') {
            const newCredits = (profile.credit_topups || 0) + 20;
            await supabase
              .from('profiles')
              .update({ credit_topups: newCredits, updated_at: new Date().toISOString() })
              .eq('id', profile.id);
            console.log('[Webhook] Added 20 credits for BULK_PACK:', newCredits);
          } else if (planType === 'PRO') {
            // Update plan type and initialize PRO usage
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            await supabase
              .from('profiles')
              .update({ 
                plan_type: 'PRO', 
                pro_month: currentMonth, 
                pro_used: 0,
                updated_at: new Date().toISOString() 
              })
              .eq('id', profile.id);
            console.log('[Webhook] Upgraded to PRO:', { currentMonth });
          }
        } else {
          console.error('[Webhook] No profile found for email:', customerEmail);
        }
      } catch (error) {
        console.error('[Webhook] Supabase update error:', error);
      }
    } else {
      console.error('[Webhook] Supabase not configured or no customer email');
    }
  }

  res.json({ received: true });
}

