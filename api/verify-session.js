import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === 'paid') {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      
      res.json({
        success: true,
        plan: session.metadata.plan,
        subscriptionId: subscription.id,
        customerId: session.customer,
        status: subscription.status,
      });
    } else {
      res.json({
        success: false,
        payment_status: session.payment_status,
      });
    }
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ error: error.message });
  }
}

