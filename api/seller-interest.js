// API endpoint for seller interest feature
// Allows users to express interest in selling their property at a specific price
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (req.method === 'POST') {
    // Submit seller interest
    const { propertyAddress, targetPrice, name, phone, email, notes } = req.body;

    // Validate required fields
    if (!propertyAddress || !targetPrice || !name || !email) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['propertyAddress', 'targetPrice', 'name', 'email']
      });
    }

    // Validate price is a number
    const priceNum = parseInt(targetPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: 'Invalid target price' });
    }

    try {
      // Insert seller interest
      const { error: insertError } = await supabase
        .from('seller_interest')
        .insert({
          user_id: user.id,
          property_address: propertyAddress,
          target_price: priceNum,
          name: name.trim(),
          phone: phone?.trim() || null,
          email: email.trim(),
          notes: notes?.trim() || null,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('[SellerInterest] Insert error:', insertError);
        return res.status(500).json({ error: 'Failed to save seller interest' });
      }

      console.log('[SellerInterest] New lead:', propertyAddress, '-', name, '-', email);

      // Send email notification to support@upblock.ai
      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          
          // Determine if buyer or seller interest based on notes
          const isBuyerInterest = notes && notes.startsWith('BUYER INTEREST');
          const leadType = isBuyerInterest ? 'Buyer' : 'Seller';
          
          await resend.emails.send({
            from: 'Upblock <hello@mail.upblock.ai>',
            to: 'support@upblock.ai',
            subject: `New ${leadType} Lead: ${propertyAddress}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">

New ${leadType.toUpperCase()} LEAD

Property: ${propertyAddress}
Price: $${targetPrice.toLocaleString()}

---

Contact:
Name: ${name}
Phone: ${phone || 'Not provided'}
Email: ${email || 'Not provided'}

${notes ? `---\n\n${notes}\n\n` : ''}---

Submitted: ${new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}

View in Admin Dashboard → Seller Leads tab

</body>
</html>
            `,
            text: `
New ${leadType.toUpperCase()} LEAD

Property: ${propertyAddress}
Price: $${targetPrice.toLocaleString()}

---

Contact:
Name: ${name}
Phone: ${phone || 'Not provided'}
Email: ${email || 'Not provided'}

${notes ? `---\n\n${notes}\n\n` : ''}---

Submitted: ${new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}

View in Admin Dashboard → Seller Leads tab
            `.trim()
          });
          
          console.log('[SellerInterest] Email notification sent to support@upblock.ai');
        } catch (emailError) {
          console.error('[SellerInterest] Failed to send email (non-critical):', emailError);
          // Don't fail the request if email fails
        }
      } else {
        console.warn('[SellerInterest] Resend API key not configured - email notification skipped');
      }

      return res.status(200).json({ 
        success: true,
        message: 'Thank you! Your interest has been recorded.'
      });

    } catch (error) {
      console.error('[SellerInterest] Error:', error);
      return res.status(500).json({ error: 'Server error' });
    }

  } else if (req.method === 'GET') {
    // Fetch seller interest submissions for admin
    try {
      // Verify admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Fetch all seller interest submissions
      const { data: leads, error } = await supabase
        .from('seller_interest')
        .select(`
          id,
          property_address,
          target_price,
          name,
          phone,
          email,
          notes,
          created_at,
          user_id,
          profiles!inner(email, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('[SellerInterest] Fetch error:', error);
        return res.status(500).json({ error: 'Failed to fetch seller leads' });
      }

      return res.status(200).json({ leads: leads || [] });

    } catch (error) {
      console.error('[SellerInterest] Error:', error);
      return res.status(500).json({ error: 'Server error' });
    }

  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
