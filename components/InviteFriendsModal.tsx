import React, { useState, useEffect } from 'react';

interface InviteFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode: string | null;
  referralLink: string | null;
  referralCount: number;
  referralCreditsEarned: number;
  onGenerateCode: () => Promise<void>;
  onSendInvite: (email: string, name?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
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
  onSendInvite,
  isLoading = false
}) => {
  const [copied, setCopied] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [activeTab, setActiveTab] = useState<'email' | 'link'>('email');
  
  // Email invite state
  const [friendEmail, setFriendEmail] = useState('');
  const [friendName, setFriendName] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen && !referralCode && !isLoading) {
      onGenerateCode();
    }
  }, [isOpen, referralCode, isLoading, onGenerateCode]);

  // Clear send result after 4 seconds
  useEffect(() => {
    if (sendResult) {
      const timer = setTimeout(() => setSendResult(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [sendResult]);

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
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`
    };

    window.open(urls[platform], '_blank', 'width=600,height=400');
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!friendEmail.trim()) return;
    
    setIsSending(true);
    setSendResult(null);
    
    try {
      const result = await onSendInvite(friendEmail.trim(), friendName.trim() || undefined);
      
      if (result.success) {
        setSendResult({ success: true, message: result.message || `Invite sent to ${friendEmail}!` });
        setFriendEmail('');
        setFriendName('');
      } else {
        setSendResult({ success: false, message: result.error || 'Failed to send invite' });
      }
    } catch (error) {
      setSendResult({ success: false, message: 'Something went wrong. Please try again.' });
    } finally {
      setIsSending(false);
    }
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
        className="relative w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
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
              <p className="text-2xl font-black" style={{ color: '#2d2d2d' }}>{referralCount}/{MAX_REFERRALS}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Friends Joined</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
              <p className="text-2xl font-black" style={{ color: '#2d2d2d' }}>+{referralCreditsEarned}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Credits Earned</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'email' 
                  ? 'bg-[#C9A961] text-white shadow-sm' 
                  : 'hover:bg-black/5'
              }`}
              style={{ color: activeTab === 'email' ? undefined : 'var(--text-muted)' }}
            >
              <i className="fa-solid fa-envelope mr-1.5"></i>
              Send Email
            </button>
            <button
              onClick={() => setActiveTab('link')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'link' 
                  ? 'bg-[#C9A961] text-white shadow-sm' 
                  : 'hover:bg-black/5'
              }`}
              style={{ color: activeTab === 'link' ? undefined : 'var(--text-muted)' }}
            >
              <i className="fa-solid fa-link mr-1.5"></i>
              Share Link
            </button>
          </div>

          {/* Email Tab */}
          {activeTab === 'email' && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="p-6 rounded-xl border text-center" style={{ borderColor: 'var(--border-color)' }}>
                  <i className="fa-solid fa-spinner fa-spin text-[#C9A961] text-xl mb-2"></i>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Setting up...</p>
                </div>
              ) : (
                <form onSubmit={handleSendEmail} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Friend's Email *
                    </label>
                    <input
                      type="email"
                      value={friendEmail}
                      onChange={(e) => setFriendEmail(e.target.value)}
                      placeholder="friend@example.com"
                      required
                      disabled={isSending}
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:border-[#C9A961] transition-colors disabled:opacity-50"
                      style={{ 
                        borderColor: 'var(--border-color)', 
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Their Name <span className="font-normal opacity-60">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={friendName}
                      onChange={(e) => setFriendName(e.target.value)}
                      placeholder="John"
                      disabled={isSending}
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:border-[#C9A961] transition-colors disabled:opacity-50"
                      style={{ 
                        borderColor: 'var(--border-color)', 
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  {/* Send Result Message */}
                  {sendResult && (
                    <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      sendResult.success 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <i className={`fa-solid ${sendResult.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                      {sendResult.message}
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isSending || !friendEmail.trim() || referralCount >= MAX_REFERRALS}
                    className="w-full py-3.5 rounded-xl bg-[#C9A961] text-white text-sm font-bold hover:bg-[#3A342D] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Sending...</>
                    ) : (
                      <><i className="fa-solid fa-paper-plane mr-2"></i>Send Invite</>
                    )}
                  </button>
                </form>
              )}
              
              <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                We'll send them a personalized email with your referral link
              </p>
            </div>
          )}

          {/* Link Tab */}
          {activeTab === 'link' && (
            <>
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
            </>
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
