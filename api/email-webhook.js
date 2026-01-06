// Resend webhook handler for email tracking events
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Resend webhook signing secret (optional but recommended for production)
const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Verify webhook signature (if RESEND_WEBHOOK_SECRET is set)
  // For now, we'll process all requests but log warnings
  if (webhookSecret) {
    const signature = req.headers['svix-signature'];
    if (!signature) {
      console.warn('[EmailWebhook] No signature provided');
    }
    // Full signature verification would require the svix library
    // For now, we'll proceed but you can add this later
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const event = req.body;
    
    if (!event || !event.type) {
      console.warn('[EmailWebhook] Invalid event received:', event);
      return res.status(400).json({ error: 'Invalid event' });
    }

    const emailId = event.data?.email_id;
    const eventType = event.type;

    console.log('[EmailWebhook] Received event:', { type: eventType, emailId });

    if (!emailId) {
      console.warn('[EmailWebhook] No email_id in event');
      return res.status(200).json({ received: true, skipped: 'no_email_id' });
    }

    // Find the invite by email_id
    const { data: invite, error: inviteError } = await supabase
      .from('referral_invites')
      .select('id, sender_id, recipient_email, recipient_name, status')
      .eq('email_id', emailId)
      .maybeSingle();

    if (inviteError) {
      console.error('[EmailWebhook] Error fetching invite:', inviteError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!invite) {
      console.log('[EmailWebhook] No invite found for email_id:', emailId);
      return res.status(200).json({ received: true, skipped: 'invite_not_found' });
    }

    // Process different event types
    switch (eventType) {
      case 'email.delivered':
        // Email was successfully delivered
        await supabase
          .from('referral_invites')
          .update({ 
            status: 'delivered',
            delivered_at: new Date().toISOString()
          })
          .eq('id', invite.id);
        console.log('[EmailWebhook] Email delivered:', emailId);
        break;

      case 'email.opened':
        // Only update and notify if not already opened
        if (invite.status !== 'opened' && invite.status !== 'clicked' && invite.status !== 'signed_up' && invite.status !== 'verified') {
          await supabase
            .from('referral_invites')
            .update({ 
              status: 'opened',
              opened_at: new Date().toISOString()
            })
            .eq('id', invite.id);

          // Create notification for the sender
          const recipientName = invite.recipient_name || invite.recipient_email.split('@')[0];
          await supabase
            .from('notifications')
            .insert({
              user_id: invite.sender_id,
              type: 'invite_opened',
              title: '📬 Your invite was opened!',
              message: `${recipientName} opened your referral invite.`,
              data: { 
                invite_id: invite.id,
                recipient_email: invite.recipient_email,
                recipient_name: invite.recipient_name
              }
            });

          console.log('[EmailWebhook] Email opened, notification sent:', emailId);
        }
        break;

      case 'email.clicked':
        // User clicked a link in the email
        if (invite.status !== 'clicked' && invite.status !== 'signed_up' && invite.status !== 'verified') {
          await supabase
            .from('referral_invites')
            .update({ 
              status: 'clicked',
              clicked_at: new Date().toISOString()
            })
            .eq('id', invite.id);

          // Create notification for the sender (only if not already notified about open)
          if (invite.status !== 'opened') {
            const recipientName = invite.recipient_name || invite.recipient_email.split('@')[0];
            await supabase
              .from('notifications')
              .insert({
                user_id: invite.sender_id,
                type: 'invite_clicked',
                title: '🎯 Your invite link was clicked!',
                message: `${recipientName} clicked your referral link and is checking out upblock.ai!`,
                data: { 
                  invite_id: invite.id,
                  recipient_email: invite.recipient_email,
                  recipient_name: invite.recipient_name
                }
              });
          }

          console.log('[EmailWebhook] Email link clicked:', emailId);
        }
        break;

      case 'email.bounced':
      case 'email.complained':
        // Email bounced or marked as spam
        await supabase
          .from('referral_invites')
          .update({ status: 'sent' }) // Reset to sent (or you could add 'bounced' status)
          .eq('id', invite.id);
        console.log('[EmailWebhook] Email bounced/complained:', emailId);
        break;

      default:
        console.log('[EmailWebhook] Unhandled event type:', eventType);
    }

    return res.status(200).json({ received: true, processed: eventType });

  } catch (error) {
    console.error('[EmailWebhook] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

