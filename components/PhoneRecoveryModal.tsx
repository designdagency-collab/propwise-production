import React, { useState } from 'react';
import { supabaseService } from '../services/supabaseService';

interface PhoneRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkip: () => void;
  onVerified: (phone: string) => void;
  userId: string;
}

const PhoneRecoveryModal: React.FC<PhoneRecoveryModalProps> = ({ 
  isOpen, 
  onClose, 
  onSkip, 
  onVerified,
  userId 
}) => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'prompt' | 'phone' | 'verify' | 'success'>('prompt');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  if (!isOpen) return null;

  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      return digits.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    } else if (digits.startsWith('61')) {
      return `+${digits.replace(/(\d{2})(\d{4})(\d{3})(\d{3})/, '$1 $2 $3 $4')}`;
    } else if (digits.length > 0) {
      return digits;
    }
    return digits;
  };

  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      return `+61${digits.substring(1)}`;
    } else if (digits.startsWith('61')) {
      return `+${digits}`;
    }
    return `+61${digits}`;
  };

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    
    if (normalizedPhone.length < 12) {
      setError('Please enter a valid Australian phone number');
      return;
    }

    setIsLoading(true);

    try {
      // Use API to send verification code
      const response = await fetch('/api/send-phone-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, phone: normalizedPhone })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send code');
      }

      setStep('verify');
      setCountdown(60);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otp.trim() || otp.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setIsLoading(true);
    const normalizedPhone = normalizePhone(phone);

    try {
      // Use API to verify code
      const response = await fetch('/api/verify-phone-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, phone: normalizedPhone, code: otp })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid code');
      }

      setStep('success');
      setTimeout(() => {
        onVerified(normalizedPhone);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setOtp('');
    setError(null);
    await handleSendOTP();
  };

  const handleSkip = async () => {
    // Mark that we've prompted them
    try {
      await fetch('/api/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          updates: { phone_recovery_prompted: true } 
        })
      });
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
    onSkip();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 max-w-md w-full shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="text-center space-y-6">
          
          {/* Prompt Step */}
          {step === 'prompt' && (
            <>
              <div className="w-16 h-16 bg-[#C9A961]/10 rounded-2xl flex items-center justify-center mx-auto">
                <i className="fa-solid fa-shield-halved text-2xl text-[#C9A961]"></i>
              </div>
              
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#3A342D] tracking-tighter mb-2">
                  Secure Your Account
                </h2>
                <p className="text-xs sm:text-sm text-[#3A342D]/60 font-medium">
                  Add your phone number for account recovery. If you ever lose access to your email, we can help you get back in.
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#C9A961]/10 text-left">
                  <span className="text-lg">🔑</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Recover your account if locked out</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#C9A961]/10 text-left">
                  <span className="text-lg">🛡️</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Additional layer of security</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#C9A961]/10 text-left">
                  <span className="text-lg">🔒</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>We'll never spam you</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button
                  onClick={() => setStep('phone')}
                  className="w-full py-4 bg-[#C9A961] text-white rounded-xl font-bold hover:bg-[#3A342D] transition-all uppercase tracking-widest text-[11px] shadow-lg flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-mobile-screen-button"></i>
                  Add Phone Number
                </button>
                <button
                  onClick={handleSkip}
                  className="w-full py-3 text-[#3A342D]/40 hover:text-[#3A342D] font-medium text-sm transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

          {/* Phone Entry Step */}
          {step === 'phone' && (
            <>
              <div className="w-16 h-16 bg-[#C9A961]/10 rounded-2xl flex items-center justify-center mx-auto">
                <i className="fa-solid fa-mobile-screen-button text-2xl text-[#C9A961]"></i>
              </div>
              
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#3A342D] tracking-tighter mb-2">
                  Enter Your Phone
                </h2>
                <p className="text-xs sm:text-sm text-[#3A342D]/60 font-medium">
                  We'll send you a 6-digit verification code via SMS.
                </p>
              </div>

              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3A342D]/40 font-medium">
                      +61
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="4XX XXX XXX"
                      className="w-full pl-16 pr-6 py-3 sm:py-4 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm sm:text-base transition-all"
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                  {error && (
                    <p className="text-red-500 text-xs mt-2 text-left">{error}</p>
                  )}
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-[#C9A961] text-white rounded-xl font-bold hover:bg-[#3A342D] transition-all uppercase tracking-widest text-[11px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        Sending Code...
                      </>
                    ) : (
                      'Send Verification Code'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('prompt')}
                    disabled={isLoading}
                    className="w-full py-3 text-[#3A342D]/40 hover:text-[#3A342D] font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    Go Back
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Verify Step */}
          {step === 'verify' && (
            <>
              <div className="w-16 h-16 bg-[#C9A961]/10 rounded-2xl flex items-center justify-center mx-auto">
                <i className="fa-solid fa-sms text-2xl text-[#C9A961]"></i>
              </div>
              
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#3A342D] tracking-tighter mb-2">
                  Enter Code
                </h2>
                <p className="text-xs sm:text-sm text-[#3A342D]/60 font-medium">
                  We sent a 6-digit code to <span className="font-bold">{normalizePhone(phone)}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-6 py-3 sm:py-4 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-bold text-xl sm:text-2xl text-center tracking-widest transition-all"
                    disabled={isLoading}
                    autoFocus
                    maxLength={6}
                  />
                  {error && (
                    <p className="text-red-500 text-xs mt-2 text-left">{error}</p>
                  )}
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="w-full py-4 bg-[#C9A961] text-white rounded-xl font-bold hover:bg-[#3A342D] transition-all uppercase tracking-widest text-[11px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        Verifying...
                      </>
                    ) : (
                      'Verify Phone'
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={countdown > 0 || isLoading}
                    className="w-full py-3 text-[#3A342D]/40 hover:text-[#3A342D] font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setStep('phone');
                      setOtp('');
                      setError(null);
                    }}
                    disabled={isLoading}
                    className="w-full py-2 text-[#3A342D]/30 hover:text-[#3A342D] font-medium text-xs transition-colors disabled:opacity-50"
                  >
                    Change Phone Number
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <>
              <div className="w-16 h-16 bg-[#C9A961]/10 rounded-2xl flex items-center justify-center mx-auto">
                <i className="fa-solid fa-check text-2xl text-[#C9A961]"></i>
              </div>
              
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#3A342D] tracking-tighter mb-2">
                  Phone Verified!
                </h2>
                <p className="text-xs sm:text-sm text-[#3A342D]/60 font-medium">
                  Your account is now more secure. You can use this phone number to recover your account if needed.
                </p>
              </div>

              <div className="pt-4">
                <div className="flex items-center justify-center gap-2 text-[#C9A961]">
                  <i className="fa-solid fa-shield-check text-lg"></i>
                  <span className="font-medium">Account Protected</span>
                </div>
              </div>
            </>
          )}

          <p className="text-[11px] text-[#3A342D]/30 leading-relaxed">
            Your phone number is used for account recovery only. We'll never spam you or share your number.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PhoneRecoveryModal;

