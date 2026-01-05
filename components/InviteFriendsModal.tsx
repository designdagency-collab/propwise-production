import React, { useState, useEffect } from 'react';

interface InviteFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode: string | null;
  referralLink: string | null;
  referralCount: number;
  referralCreditsEarned: number;
  onGenerateCode: () => Promise<void>;
  isLoading?: boolean;
}

const MAX_REFERRALS = 10;

const InviteFriendsModal: React.FC<InviteFriendsModalProps> = ({
  isOpen,
  onClose,
  referralCode,
  referralLink,
  referralCount,
  referralCreditsEarned,
  onGenerateCode,
  isLoading = false
}) => {
  const [copied, setCopied] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  useEffect(() => {
    if (isOpen && !referralCode && !isLoading) {
      onGenerateCode();
    }
  }, [isOpen, referralCode, isLoading, onGenerateCode]);

  const handleCopy = async () => {
    if (referralLink) {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = (platform: string) => {
    if (!referralLink) return;
    
    const message = encodeURIComponent(`Check out upblock.ai - AI-powered property audits! Use my link to get 3 free audits: ${referralLink}`);
    
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${message}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`,
      twitter: `https://twitter.com/intent/tweet?text=${message}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
      email: `mailto:?subject=Check out upblock.ai&body=${decodeURIComponent(message)}`
    };

    window.open(urls[platform], '_blank', 'width=600,height=400');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--accent-gold-light)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#C9A961] flex items-center justify-center">
                <i className="fa-solid fa-gift text-white text-xl"></i>
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Invite Friends</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Get 3 free audits for each friend!</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/10 transition-colors"
            >
              <i className="fa-solid fa-xmark text-lg" style={{ color: 'var(--text-muted)' }}></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
              <p className="text-2xl font-black text-[#C9A961]">{referralCount}/{MAX_REFERRALS}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Friends Invited</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
              <p className="text-2xl font-black text-emerald-600">+{referralCreditsEarned}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Credits Earned</p>
            </div>
          </div>

          {/* How it works */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>How it works</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#C9A961]/20 text-[#C9A961] text-xs font-bold flex items-center justify-center">1</span>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Share your unique link with friends</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#C9A961]/20 text-[#C9A961] text-xs font-bold flex items-center justify-center">2</span>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>They sign up and verify their phone</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#C9A961]/20 text-[#C9A961] text-xs font-bold flex items-center justify-center">3</span>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>You both get 3 free property audits!</p>
              </div>
            </div>
          </div>

          {/* Referral Link */}
          {isLoading ? (
            <div className="p-4 rounded-xl border text-center" style={{ borderColor: 'var(--border-color)' }}>
              <i className="fa-solid fa-spinner fa-spin text-[#C9A961] text-xl mb-2"></i>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Generating your unique link...</p>
            </div>
          ) : referralCode && referralLink ? (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Your referral link</p>
              <div 
                className="flex items-center gap-2 p-3 rounded-xl border"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
              >
                <input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="flex-1 bg-transparent text-sm font-mono outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    copied 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-[#C9A961] text-white hover:bg-[#3A342D]'
                  }`}
                >
                  {copied ? (
                    <><i className="fa-solid fa-check mr-1"></i> Copied!</>
                  ) : (
                    <><i className="fa-solid fa-copy mr-1"></i> Copy</>
                  )}
                </button>
              </div>
              
              {/* Share buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleShare('whatsapp')}
                  className="flex-1 p-3 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:opacity-90 transition-opacity"
                >
                  <i className="fa-brands fa-whatsapp mr-1"></i> WhatsApp
                </button>
                <button
                  onClick={() => handleShare('email')}
                  className="flex-1 p-3 rounded-xl border font-bold text-xs hover:bg-black/5 transition-colors"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <i className="fa-solid fa-envelope mr-1"></i> Email
                </button>
                <button
                  onClick={() => setShowShareOptions(!showShareOptions)}
                  className="p-3 rounded-xl border hover:bg-black/5 transition-colors"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                >
                  <i className="fa-solid fa-ellipsis"></i>
                </button>
              </div>

              {/* More share options */}
              {showShareOptions && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleShare('facebook')}
                    className="flex-1 p-3 rounded-xl bg-[#1877F2] text-white font-bold text-xs hover:opacity-90 transition-opacity"
                  >
                    <i className="fa-brands fa-facebook mr-1"></i> Facebook
                  </button>
                  <button
                    onClick={() => handleShare('twitter')}
                    className="flex-1 p-3 rounded-xl bg-black text-white font-bold text-xs hover:opacity-90 transition-opacity"
                  >
                    <i className="fa-brands fa-x-twitter mr-1"></i> Twitter
                  </button>
                  <button
                    onClick={() => handleShare('linkedin')}
                    className="flex-1 p-3 rounded-xl bg-[#0A66C2] text-white font-bold text-xs hover:opacity-90 transition-opacity"
                  >
                    <i className="fa-brands fa-linkedin mr-1"></i> LinkedIn
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl border text-center" style={{ borderColor: 'var(--border-color)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Unable to generate referral link. Please try again.</p>
              <button
                onClick={onGenerateCode}
                className="mt-2 px-4 py-2 bg-[#C9A961] text-white rounded-lg text-xs font-bold hover:bg-[#3A342D] transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Max referrals warning */}
          {referralCount >= MAX_REFERRALS && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <p className="text-xs text-amber-700">
                <i className="fa-solid fa-circle-info mr-1"></i>
                You've reached the maximum of {MAX_REFERRALS} referrals. Thanks for spreading the word!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
          <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
            Credits are awarded when your friend verifies their phone number. Max {MAX_REFERRALS} referrals per user.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InviteFriendsModal;

