import React, { useState } from 'react';
import { supabaseService } from '../services/supabaseService';

interface SellerInterestModalProps {
  onClose: () => void;
  propertyAddress: string;
  targetPrice: number;
  valueAddStrategies: any[];
  userProfile: any;
  isLoggedIn: boolean;
}

const SellerInterestModal: React.FC<SellerInterestModalProps> = ({
  onClose,
  propertyAddress,
  targetPrice,
  valueAddStrategies,
  userProfile,
  isLoggedIn,
}) => {
  // Buyer flow when no value-add strategies were generated for this property.
  const isBuyer = !valueAddStrategies || valueAddStrategies.length === 0;

  const [name, setName] = useState(userProfile?.full_name || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trim trailing ", Australia" from Google Places output for cleaner display
  const cleanAddress = propertyAddress.replace(/,\s*Australia\s*$/i, '');

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError('Please add your name, phone, and email.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const notesText = isBuyer
      ? `BUYER INTEREST${notes ? `\n\n${notes}` : ''}`
      : `SELLER INTEREST${notes ? `\n\n${notes}` : ''}`;

    try {
      const authToken = isLoggedIn && userProfile ? await supabaseService.getAccessToken() : null;
      const response = await fetch('https://upblock.ai/api/seller-interest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          propertyAddress,
          targetPrice,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          notes: notesText,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not submit. Please try again.');
      }

      setSuccess(true);
      setTimeout(() => onClose(), 2200);
    } catch (e: any) {
      setError(e.message || 'Network error. Please try again.');
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="rounded-3xl p-10 max-w-md w-full text-center"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid #DCD7CE', boxShadow: '0 24px 64px -16px rgba(74,65,55,0.18)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5 border border-emerald-100">
            <i className="fa-solid fa-check text-emerald-600 text-xl"></i>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-[#3A342D] mb-2">Thanks — we've got it.</h3>
          <p className="text-sm text-[#4A4137]/70 leading-relaxed">
            We'll be in touch shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid #DCD7CE', boxShadow: '0 24px 64px -16px rgba(74,65,55,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 sm:p-8 pb-4">
          <div className="flex-1 min-w-0">
            <span className="inline-block px-3 py-1 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-3">
              {isBuyer ? 'Buyer interest' : 'Open to a conversation'}
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] leading-tight">
              {isBuyer ? "I'd like to know more." : "Let's chat."}
            </h3>
            <p className="text-sm text-[#4A4137]/60 mt-2">
              Leave your details and we'll be in touch.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 rounded-full hover:bg-[#F0EDE5] flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark text-[#4A4137]/50"></i>
          </button>
        </div>

        {/* Property card */}
        <div className="px-6 sm:px-8">
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #E8E6E3' }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-1">Your property</p>
            <p className="text-sm font-bold text-[#3A342D] leading-snug mb-1">{cleanAddress}</p>
            {targetPrice ? (
              <p className="text-xs text-[#4A4137]/60">
                Indicative value: <span className="font-bold text-[#C9A961]">${targetPrice.toLocaleString()}</span>
              </p>
            ) : null}
          </div>
        </div>

        {/* Form */}
        <form
          className="p-6 sm:p-8 pt-5 space-y-4"
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoCapitalize="words"
              className="w-full px-4 py-3 rounded-xl text-sm font-medium text-[#3A342D] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A961] transition"
              style={{ border: '1px solid #DCD7CE' }}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="04XX XXX XXX"
              inputMode="tel"
              className="w-full px-4 py-3 rounded-xl text-sm font-medium text-[#3A342D] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A961] transition"
              style={{ border: '1px solid #DCD7CE' }}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              inputMode="email"
              className="w-full px-4 py-3 rounded-xl text-sm font-medium text-[#3A342D] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A961] transition"
              style={{ border: '1px solid #DCD7CE' }}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">
              Anything else? <span className="opacity-60 font-medium normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={isBuyer
                ? 'Timing, finance, what you\'re looking for…'
                : 'Recent improvements, timeline, anything we should know…'}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium text-[#3A342D] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A961] transition resize-none"
              style={{ border: '1px solid #DCD7CE' }}
            />
          </div>

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200">
              <i className="fa-solid fa-circle-exclamation text-rose-600 mt-0.5"></i>
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl font-bold uppercase tracking-widest text-[10px] text-[#4A4137]/70 hover:bg-[#F0EDE5] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] py-3.5 rounded-xl font-black uppercase tracking-[0.18em] text-[11px] bg-[#3A342D] text-white hover:bg-[#C9A961] transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Sending…</>
              ) : (
                <>Send my details <i className="fa-solid fa-arrow-right ml-1.5"></i></>
              )}
            </button>
          </div>

          <p className="text-[11px] text-center text-[#4A4137]/50 leading-relaxed">
            We'll only contact you about this property. No spam.
          </p>
        </form>
      </div>
    </div>
  );
};

export default SellerInterestModal;
