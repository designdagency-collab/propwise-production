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

    // Send the email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'upblock.ai <hello@mail.upblock.ai>',
      to: friendEmail,
      subject: `${senderName} invited you to try upblock.ai`,
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

// Generate HTML email
function generateEmailHtml(senderName, friendName, referralLink, code) {
  const greeting = friendName ? `Hi ${friendName}` : 'Hi there';
  const ctaLink = `https://upblock.ai/?autofocus=1&ref=${code}&utm_source=invite&utm_medium=email&utm_campaign=guru_mode`;
  
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
            <td style="background-color: #FAF9F6; padding: 32px 40px; text-align: center; border-bottom: 1px solid #E8E6E3;">
              <img src="https://upblock.ai/upblock.ai-logo.png" alt="upblock.ai" style="height: 50px; width: auto;">
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #3A342D;">
                Real Estate Guru Mode: On 🧠
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #6B6560; line-height: 1.5;">
                ${greeting}, <strong>${senderName}</strong> thinks you'll love upblock.ai.
              </p>
              
              <!-- Subhead -->
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #3A342D; line-height: 1.5;">
                Instant property snapshot: value range + nearby solds + upside scenarios <span style="color: #9B9590;">(AI-assisted)</span>.
              </p>
              
              <!-- Value prop -->
              <div style="background-color: #FAF9F6; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #3A342D;">
                      <span style="color: #C9A961; font-weight: bold;">✓</span> &nbsp;<strong>Value range</strong> — quick reality check
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #3A342D;">
                      <span style="color: #C9A961; font-weight: bold;">✓</span> &nbsp;<strong>Nearby solds</strong> — real sale prices
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #3A342D;">
                      <span style="color: #C9A961; font-weight: bold;">✓</span> &nbsp;<strong>Upside scenarios</strong> — reno potential
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Fake Input Bar CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${ctaLink}" style="display: block; text-decoration: none; max-width: 420px; width: 100%;">
                      <table cellpadding="0" cellspacing="0" style="width: 100%; background-color: #ffffff; border: 1px solid rgba(0,0,0,0.18); border-radius: 14px; box-shadow: 0 6px 18px rgba(0,0,0,0.06);">
                        <tr>
                          <td style="padding: 14px 16px;">
                            <table cellpadding="0" cellspacing="0" style="width: 100%;">
                              <tr>
                                <td style="font-size: 15px; color: #8a8a8a; vertical-align: middle;">
                                  Enter an address…
                                </td>
                                <td style="text-align: right; vertical-align: middle; width: 100px;">
                                  <span style="display: inline-block; background-color: #C9A961; color: #111111; font-size: 14px; font-weight: 700; padding: 10px 18px; border-radius: 10px;">
                                    Search →
                                  </span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 12px;">
                    <p style="margin: 0; font-size: 12px; color: #9B9590;">
                      Takes ~60 seconds
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; font-size: 12px; color: #9B9590; text-align: center;">
                Your referral code: <strong style="color: #C9A961;">${code}</strong>
              </p>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: #9B9590; text-align: center;">
                This offer is for new accounts only. Already have an account? Sign in to use your existing credits.
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
function generateEmailText(senderName, friendName, referralLink, code) {
  const greeting = friendName ? `Hi ${friendName}` : 'Hi there';
  const ctaLink = `https://upblock.ai/?autofocus=1&ref=${code}&utm_source=invite&utm_medium=email&utm_campaign=guru_mode`;
  
  return `
${greeting}, ${senderName} thinks you'll love upblock.ai.

🧠 Real Estate Guru Mode: On

Instant property snapshot: value range + nearby solds + upside scenarios (AI-assisted).

✓ Value range — quick reality check
✓ Nearby solds — real sale prices
✓ Upside scenarios — reno potential

👉 Enter an address and search: ${ctaLink}

Takes ~60 seconds.

Your referral code: ${code}

Note: This offer is for new accounts only.

---
© ${new Date().getFullYear()} upblock.ai
You received this because ${senderName} thought you'd find it useful.
`.trim();
}

