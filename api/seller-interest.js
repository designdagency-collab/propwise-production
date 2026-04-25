// API endpoint for seller interest feature
// Allows users to express interest in selling their property at a specific price
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

// Compass bearing from one lat/lng to another (0=N, 90=E).
function bearing(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLng = toRad(to.lng - from.lng);
  const fromLat = toRad(from.lat);
  const toLat = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Fetch a Street View image as base64. Returns { base64, status } where status
// is 'available' or 'unavailable'. Never throws — used for fire-and-forget.
async function fetchStreetViewBase64(address) {
  if (!googleApiKey || !address) return { base64: null, status: 'unavailable' };
  try {
    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(address)}&radius=500&key=${googleApiKey}`;
    const meta = await (await fetch(metaUrl)).json();
    if (meta.status !== 'OK' || !meta.location || !meta.pano_id) {
      console.log('[SellerInterest:StreetView] No imagery for', address.substring(0, 60), 'status:', meta.status);
      return { base64: null, status: 'unavailable' };
    }

    let heading;
    try {
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=au&components=country:AU&key=${googleApiKey}`;
      const geo = await (await fetch(geoUrl)).json();
      if (geo.status === 'OK' && geo.results?.[0]?.geometry?.location) {
        heading = bearing(meta.location, geo.results[0].geometry.location);
      }
    } catch {}

    const params = new URLSearchParams({
      size: '600x400',
      pano: meta.pano_id,
      fov: '80',
      pitch: '0',
      key: googleApiKey,
    });
    if (heading !== undefined) params.set('heading', heading.toFixed(1));

    const imageRes = await fetch(`https://maps.googleapis.com/maps/api/streetview?${params}`);
    if (!imageRes.ok) return { base64: null, status: 'unavailable' };

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    return { base64: `data:image/jpeg;base64,${buffer.toString('base64')}`, status: 'available' };
  } catch (e) {
    console.error('[SellerInterest:StreetView] Fetch error:', e.message);
    return { base64: null, status: 'unavailable' };
  }
}

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

  // Try to get user if authenticated, but allow anonymous submissions
  let user = null;
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const { data: authData } = await supabase.auth.getUser(token);
    user = authData?.user || null;
  }

  if (req.method === 'POST') {
    // Submit seller/buyer interest (no auth required - property owners don't need accounts)
    const { propertyAddress, targetPrice, name, phone, email, notes } = req.body;

    console.log('[SellerInterest] POST request received:', {
      propertyAddress: propertyAddress?.substring(0, 50),
      targetPrice,
      name,
      email,
      hasUser: !!user,
      userId: user?.id
    });

    // Validate required fields
    if (!propertyAddress || !targetPrice || !name || !email) {
      console.error('[SellerInterest] Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['propertyAddress', 'targetPrice', 'name', 'email']
      });
    }

    // Validate price is a number
    const priceNum = parseInt(targetPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      console.error('[SellerInterest] Invalid price:', targetPrice);
      return res.status(400).json({ error: 'Invalid target price' });
    }

    try {
      // Insert seller interest (user_id can be null for anonymous submissions)
      console.log('[SellerInterest] Inserting into database...');
      const { data: inserted, error: insertError } = await supabase
        .from('seller_interest')
        .insert({
          user_id: user?.id || null,
          property_address: propertyAddress,
          target_price: priceNum,
          name: name.trim(),
          phone: phone?.trim() || null,
          email: email.trim(),
          notes: notes?.trim() || null,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[SellerInterest] Insert error:', insertError);
        return res.status(500).json({ error: 'Failed to save seller interest', details: insertError.message });
      }

      console.log('[SellerInterest] ✅ Saved to database:', propertyAddress, '-', name, '-', email);

      // Fire-and-forget: prefetch the Street View image so it's ready by the
      // time a subscriber reveals this lead. Don't block the response on it —
      // even if Google is slow or the address has no imagery, the lead is
      // saved and the dashboard handles a missing image gracefully.
      if (inserted?.id) {
        (async () => {
          try {
            const { base64, status } = await fetchStreetViewBase64(propertyAddress);
            await supabase
              .from('seller_interest')
              .update({ street_view_image: base64, street_view_status: status })
              .eq('id', inserted.id);
            console.log('[SellerInterest] Street View prefetch:', status, 'for', propertyAddress.substring(0, 50));
          } catch (e) {
            console.error('[SellerInterest] Street View prefetch failed:', e.message);
          }
        })();
      }

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
    // Fetch seller interest submissions for admin (requires authentication)
    if (!user) {
      return res.status(401).json({ error: 'Authentication required for admin access' });
    }

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

      // Fetch all seller interest submissions (left join since user_id can be null for anonymous)
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
          profiles(email, phone)
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
