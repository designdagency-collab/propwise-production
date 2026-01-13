// Send referral invite email via Resend
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

// Rate limit: max 10 invites per user per day
const MAX_DAILY_INVITES = 10;

// Generate a short, memorable referral code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://upblock.ai', 'https://www.upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { friendEmail, friendName } = req.body;

  if (!friendEmail) {
    return res.status(400).json({ error: 'Friend email is required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(friendEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    // Get user's profile and referral code
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code, full_name, email')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    // Auto-generate referral code if user doesn't have one
    if (!profile.referral_code) {
      let code = generateCode();
      let attempts = 0;
      const maxAttempts = 10;

      // Ensure code is unique
      while (attempts < maxAttempts) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', code)
          .maybeSingle();

        if (!existing) break;
        code = generateCode();
        attempts++;
      }

      if (attempts >= maxAttempts) {
        return res.status(500).json({ error: 'Failed to generate unique referral code' });
      }

      // Save the code to user's profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ referral_code: code })
        .eq('id', user.id);

      if (updateError) {
        console.error('[ReferralInvite] Failed to save referral code:', updateError);
        return res.status(500).json({ error: 'Failed to generate referral code' });
      }

      profile.referral_code = code;
      console.log('[ReferralInvite] Auto-generated referral code for user:', user.id, code);
    }

    // Check daily invite limit (simple rate limiting)
    const today = new Date().toISOString().split('T')[0];
    const { data: todayInvites } = await supabase
      .from('referral_invites')
      .select('id')
      .eq('sender_id', user.id)
      .gte('created_at', `${today}T00:00:00Z`);

    if (todayInvites && todayInvites.length >= MAX_DAILY_INVITES) {
      return res.status(429).json({ 
        error: `Daily limit reached. You can send ${MAX_DAILY_INVITES} invites per day.` 
      });
    }

    // Check if already invited this email
    const { data: existingInvite } = await supabase
      .from('referral_invites')
      .select('id')
      .eq('sender_id', user.id)
      .eq('recipient_email', friendEmail.toLowerCase())
      .maybeSingle();

    if (existingInvite) {
      return res.status(400).json({ error: 'You have already invited this email address.' });
    }

    // Check if Resend is configured
    if (!resendApiKey) {
      console.error('[ReferralInvite] Resend API key not configured');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    const resend = new Resend(resendApiKey);
    const referralLink = `https://upblock.ai/?ref=${profile.referral_code}`;
    const senderName = profile.full_name || profile.email?.split('@')[0] || 'A friend';

    // Send the email - Personal style subject line (avoids Promotions tab)
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'upblock.ai <hello@mail.upblock.ai>',
      to: friendEmail,
      subject: `${senderName} shared something with you`,
      html: generateEmailHtml(senderName, friendName, referralLink, profile.referral_code),
      text: generateEmailText(senderName, friendName, referralLink, profile.referral_code)
    });

    if (emailError) {
      console.error('[ReferralInvite] Resend error:', emailError);
      return res.status(500).json({ error: 'Failed to send email. Please try again.' });
    }

    // Record the invite with Resend email ID for tracking
    await supabase
      .from('referral_invites')
      .insert({
        sender_id: user.id,
        recipient_email: friendEmail.toLowerCase(),
        recipient_name: friendName || null,
        referral_code: profile.referral_code,
        email_id: emailData?.id || null, // Store Resend email ID for webhook tracking
        status: 'sent'
      });

    console.log('[ReferralInvite] Email sent:', { to: friendEmail, from: user.id, emailId: emailData?.id });

    return res.status(200).json({ 
      success: true,
      message: `Invite sent to ${friendEmail}`
    });

  } catch (error) {
    console.error('[ReferralInvite] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Generate HTML email - PERSONAL STYLE (avoids Gmail Promotions tab)
// Key: Minimal HTML, conversational tone, no heavy marketing design
function generateEmailHtml(senderName, friendName, referralLink, code) {
  const greeting = friendName ? `Hey ${friendName}` : 'Hey';
  const ctaLink = `https://upblock.ai/?ref=${code}`;
  
  // Personal-style email that looks like a friend forwarded something
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #333;">
  
  <p>${greeting},</p>
  
  <p>${senderName} thought you'd find this useful – it's a property tool I've been using called <a href="${ctaLink}" style="color: #C9A961;">upblock.ai</a>.</p>
  
  <p>You type in any address and it gives you:</p>
  <ul style="padding-left: 20px; margin: 16px 0;">
    <li>Estimated value range (pretty accurate from what I've seen)</li>
    <li>Recent sold prices nearby</li>
    <li>Renovation ideas with ROI estimates</li>
  </ul>
  
  <p>Takes about a minute. Here's the link if you want to try it:</p>
  
  <p><a href="${ctaLink}" style="color: #C9A961; font-weight: 600;">${ctaLink}</a></p>
  
  <p>Let me know what you think!</p>
  
  <p style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: #888;">
    Sent via <a href="https://upblock.ai" style="color: #888;">upblock.ai</a>
  </p>

</body>
</html>
`;
}

// Generate plain text version - PERSONAL STYLE
function generateEmailText(senderName, friendName, referralLink, code) {
  const greeting = friendName ? `Hey ${friendName}` : 'Hey';
  const ctaLink = `https://upblock.ai/?ref=${code}`;
  
  return `
${greeting},

${senderName} thought you'd find this useful – it's a property tool I've been using called upblock.ai.

You type in any address and it gives you:
- Estimated value range (pretty accurate from what I've seen)
- Recent sold prices nearby
- Renovation ideas with ROI estimates

Takes about a minute. Here's the link if you want to try it:
${ctaLink}

Let me know what you think!

---
Sent via upblock.ai
`.trim();
}

