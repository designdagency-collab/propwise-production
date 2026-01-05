// Send referral invite email via Resend
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

// Rate limit: max 10 invites per user per day
const MAX_DAILY_INVITES = 10;

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://upblock.ai', 'http://localhost:5173', 'http://localhost:3000'];
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

    if (!profile.referral_code) {
      return res.status(400).json({ error: 'No referral code found. Please generate one first.' });
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

    // Send the email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'upblock.ai <hello@mail.upblock.ai>',
      to: friendEmail,
      subject: `${senderName} invited you to try upblock.ai`,
      html: generateEmailHtml(senderName, friendName, referralLink, profile.referral_code),
      text: generateEmailText(senderName, friendName, referralLink)
    });

    if (emailError) {
      console.error('[ReferralInvite] Resend error:', emailError);
      return res.status(500).json({ error: 'Failed to send email. Please try again.' });
    }

    // Record the invite
    await supabase
      .from('referral_invites')
      .insert({
        sender_id: user.id,
        recipient_email: friendEmail.toLowerCase(),
        recipient_name: friendName || null,
        referral_code: profile.referral_code,
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

// Generate HTML email
function generateEmailHtml(senderName, friendName, referralLink, code) {
  const greeting = friendName ? `Hi ${friendName}` : 'Hi there';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to upblock.ai</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f0; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3A342D 0%, #4A443D 100%); padding: 32px 40px; text-align: center;">
              <img src="https://upblock.ai/upblock.ai-logo.png" alt="upblock.ai" style="height: 50px; width: auto;">
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #3A342D;">
                You're invited! 🎁
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #6B6560; line-height: 1.5;">
                ${greeting}, <strong>${senderName}</strong> thinks you'd love upblock.ai.
              </p>
              
              <!-- Value prop -->
              <div style="background-color: #FAF9F6; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #3A342D; font-weight: 600;">
                  What you get:
                </p>
                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #3A342D;">
                      <span style="color: #C9A961; font-weight: bold;">✓</span> &nbsp;3 free AI property audits
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #3A342D;">
                      <span style="color: #C9A961; font-weight: bold;">✓</span> &nbsp;Instant value estimates
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #3A342D;">
                      <span style="color: #C9A961; font-weight: bold;">✓</span> &nbsp;Renovation uplift scenarios
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #3A342D;">
                      <span style="color: #C9A961; font-weight: bold;">✓</span> &nbsp;Local comparable sales
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${referralLink}" style="display: inline-block; background-color: #C9A961; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 16px 40px; border-radius: 10px; text-transform: uppercase; letter-spacing: 1px;">
                      Get Started Free →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; font-size: 12px; color: #9B9590; text-align: center;">
                Your referral code: <strong style="color: #C9A961;">${code}</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF9F6; padding: 24px 40px; text-align: center; border-top: 1px solid #E8E6E3;">
              <p style="margin: 0; font-size: 11px; color: #9B9590;">
                © ${new Date().getFullYear()} upblock.ai · AI-powered property intelligence
              </p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #9B9590;">
                You received this because ${senderName} thought you'd find it useful.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// Generate plain text version
function generateEmailText(senderName, friendName, referralLink) {
  const greeting = friendName ? `Hi ${friendName}` : 'Hi there';
  
  return `
${greeting},

${senderName} invited you to try upblock.ai - AI-powered property intelligence for Australian real estate.

What you get:
• 3 free AI property audits
• Instant value estimates
• Renovation uplift scenarios
• Local comparable sales

Get started free: ${referralLink}

---
© ${new Date().getFullYear()} upblock.ai
You received this because ${senderName} thought you'd find it useful.
`.trim();
}

