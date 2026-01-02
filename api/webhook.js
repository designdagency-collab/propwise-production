import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper to read raw body from request stream
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

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
    const rawBody = await getRawBody(req);
    
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    console.log('[Webhook] Event verified:', event.type);
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_email;
    const userId = session.metadata?.userId; // Primary lookup method
    const planType = session.metadata?.plan || 'STARTER_PACK';
    
    console.log('[Webhook] Processing payment:', { userId, customerEmail, planType, sessionId: session.id });
    
    // Update subscription and credits in Supabase if configured
    if (supabase && (userId || customerEmail)) {
      try {
        let profile = null;
        
        // First try to find by userId (most reliable)
        if (userId) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          profile = data;
          if (profile) {
            console.log('[Webhook] Found profile by userId:', userId);
          }
        }
        
        // Fallback to email lookup if userId didn't work
        if (!profile && customerEmail) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', customerEmail)
            .single();
          profile = data;
          if (profile) {
            console.log('[Webhook] Found profile by email:', customerEmail);
          }
        }

        if (profile) {
          console.log('[Webhook] Profile found:', { id: profile.id, email: profile.email, currentCredits: profile.credit_topups });
          
          // Deactivate old subscriptions
          await supabase
            .from('subscriptions')
            .update({ status: 'inactive' })
            .eq('user_id', profile.id)
            .eq('status', 'active');

          // Create new subscription record
          const { error: subscriptionError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: profile.id,
              plan_type: planType,
              status: 'active',
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              stripe_session_id: session.id
            });
          
          if (subscriptionError) {
            console.error('[Webhook] Subscription insert error:', subscriptionError.message);
          }

          // Add credits based on plan type
          let updateResult;
          if (planType === 'STARTER_PACK') {
            const newCredits = (profile.credit_topups || 0) + 3;
            updateResult = await supabase
              .from('profiles')
              .update({ credit_topups: newCredits, updated_at: new Date().toISOString() })
              .eq('id', profile.id);
            console.log('[Webhook] Added 3 credits for STARTER_PACK. New total:', newCredits);
          } else if (planType === 'BULK_PACK') {
            const newCredits = (profile.credit_topups || 0) + 20;
            updateResult = await supabase
              .from('profiles')
              .update({ credit_topups: newCredits, updated_at: new Date().toISOString() })
              .eq('id', profile.id);
            console.log('[Webhook] Added 20 credits for BULK_PACK. New total:', newCredits);
          } else if (planType === 'PRO') {
            // Update plan type and initialize PRO usage
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            updateResult = await supabase
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
          
          if (updateResult?.error) {
            console.error('[Webhook] Profile update error:', updateResult.error.message);
          } else {
            console.log('[Webhook] Profile updated successfully');
          }
        } else {
          console.error('[Webhook] No profile found:', { userId, customerEmail });
        }
      } catch (error) {
        console.error('[Webhook] Supabase error:', error.message || error);
      }
    } else {
      console.error('[Webhook] Cannot process - Supabase not configured or no user identifier:', { 
        supabaseConfigured: !!supabase, 
        userId, 
        customerEmail 
      });
    }
  }

  res.json({ received: true });
}

// Disable body parsing - Stripe needs raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
