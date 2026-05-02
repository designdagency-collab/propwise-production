import React, { useState, useEffect, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';

interface SellerInterestModalProps {
  onClose: () => void;
  propertyAddress: string;
  targetPrice: number;
  valueAddStrategies: any[];
  userProfile: any;
  isLoggedIn: boolean;
}

type Phase = 'details' | 'otp';

const SellerInterestModal: React.FC<SellerInterestModalProps> = ({
  onClose,
  propertyAddress,
  targetPrice,
  valueAddStrategies,
  userProfile,
  isLoggedIn,
}) => {
  const isBuyer = !valueAddStrategies || valueAddStrategies.length === 0;

  const [phase, setPhase] = useState<Phase>('details');
  const [name, setName] = useState(userProfile?.full_name || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [notes, setNotes] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  const cleanAddress = propertyAddress.replace(/,\s*Australia\s*$/i, '');

  // Countdown for the resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Autofocus the OTP input when we move to the otp phase
  useEffect(() => {
    if (phase === 'otp') otpInputRef.current?.focus();
  }, [phase]);

  const handleSendCode = async () => {
    setError(null);
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError('Please add your name, phone, and email.');
      return;
    }
    setSendingCode(true);
    try {
      const response = await fetch('https://upblock.ai/api/send-seller-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429 && data.waitFor) setResendCooldown(data.waitFor);
        throw new Error(data.error || 'Could not send code. Please try again.');
      }
      setPhase('otp');
      setResendCooldown(60);
    } catch (e: any) {
      setError(e.message || 'Could not send code. Please try again.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!/^\d{6}$/.test(otpCode)) {
      setError('Please enter the 6-digit code from your SMS.');
      return;
    }

    setSubmitting(true);
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
          otpCode,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Could not submit. Please try again.');
      }

      setSuccess(true);
      setTimeout(() => onClose(), 2200);
    } catch (e: any) {
      setError(e.message || 'Network error. Please try again.');
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || sendingCode) return;
    setError(null);
    setOtpCode('');
    await handleSendCode();
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
          <p className="text-sm text-[#4A4137]/70 leading-relaxed">We'll be in touch shortly.</p>
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
              {phase === 'details' ? (isBuyer ? "I'd like to know more." : "Let's chat.") : 'Verify your mobile.'}
            </h3>
            <p className="text-sm text-[#4A4137]/60 mt-2">
              {phase === 'details'
                ? 'Leave your details — we send a 6-digit code to verify your mobile.'
                : `Code sent to ${phone}.`}
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

        {/* Body */}
        {phase === 'details' ? (
          <form
            className="p-6 sm:p-8 pt-5 space-y-4"
            onSubmit={(e) => { e.preventDefault(); handleSendCode(); }}
          >
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">Name</label>
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
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">Mobile</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="04XX XXX XXX"
                inputMode="tel"
                autoComplete="tel"
                className="w-full px-4 py-3 rounded-xl text-sm font-medium text-[#3A342D] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A961] transition"
                style={{ border: '1px solid #DCD7CE' }}
                required
              />
              <p className="text-[11px] text-[#4A4137]/50 mt-1.5">Australian mobiles only. We'll send a verification code by SMS.</p>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">Email</label>
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
                placeholder={isBuyer ? "Timing, finance, what you're looking for…" : 'Recent improvements, timeline, anything we should know…'}
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
                disabled={sendingCode}
                className="flex-[2] py-3.5 rounded-xl font-black uppercase tracking-[0.18em] text-[11px] bg-[#3A342D] text-white hover:bg-[#C9A961] transition-colors disabled:opacity-60"
              >
                {sendingCode ? (
                  <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Sending code…</>
                ) : (
                  <>Send verification code <i className="fa-solid fa-arrow-right ml-1.5"></i></>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form
            className="p-6 sm:p-8 pt-5 space-y-4"
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          >
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50 mb-2">
                6-digit code
              </label>
              <input
                ref={otpInputRef}
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="w-full px-4 py-4 rounded-xl text-2xl font-black tracking-[0.5em] text-center text-[#3A342D] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A961] transition"
                style={{ border: '1px solid #DCD7CE' }}
                required
              />
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => setPhase('details')}
                  className="text-[11px] font-bold uppercase tracking-widest text-[#4A4137]/60 hover:text-[#C9A961] transition-colors"
                >
                  <i className="fa-solid fa-arrow-left mr-1"></i> Edit number
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || sendingCode}
                  className="text-[11px] font-bold uppercase tracking-widest text-[#C9A961] hover:text-[#3A342D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {sendingCode ? 'Resending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
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
                disabled={submitting || otpCode.length !== 6}
                className="flex-[2] py-3.5 rounded-xl font-black uppercase tracking-[0.18em] text-[11px] bg-[#3A342D] text-white hover:bg-[#C9A961] transition-colors disabled:opacity-60"
              >
                {submitting ? (
                  <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Verifying…</>
                ) : (
                  <>Verify &amp; submit <i className="fa-solid fa-check ml-1.5"></i></>
                )}
              </button>
            </div>

            <p className="text-[11px] text-center text-[#4A4137]/50 leading-relaxed pt-2">
              We'll only contact you about this property. No spam.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default SellerInterestModal;
