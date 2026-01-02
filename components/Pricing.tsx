import React from 'react';
import { PlanType } from '../types';
import { supabaseService } from '../services/supabaseService';

interface PricingProps {
  currentPlan?: PlanType;
  onUpgrade: (plan: PlanType) => void;
  onBack: () => void;
  onShowTerms?: () => void;
  onSignUp?: () => void;
  isLoggedIn?: boolean;
  userId?: string;
}

const Pricing: React.FC<PricingProps> = ({ currentPlan = 'FREE_TRIAL', onUpgrade, onBack, onShowTerms, onSignUp, isLoggedIn = false, userId }) => {
  const [isProcessing, setIsProcessing] = React.useState<PlanType | null>(null);
  const [waitlistJoined, setWaitlistJoined] = React.useState(false);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = React.useState(false);

  const handleSelectStarter = async () => {
    setIsProcessing('STARTER_PACK');
    try {
      await onUpgrade('STARTER_PACK');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSelectBulkPack = async () => {
    setIsProcessing('BULK_PACK' as PlanType);
    try {
      await onUpgrade('BULK_PACK' as PlanType);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSelectPro = async () => {
    if (currentPlan === 'PRO') return;
    setIsProcessing('PRO');
    try {
      await onUpgrade('PRO');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!userId || waitlistJoined) return;
    setIsJoiningWaitlist(true);
    try {
      const response = await supabaseService.authenticatedFetch('/api/join-enterprise-waitlist', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      if (response.ok) {
        setWaitlistJoined(true);
      }
    } catch (err) {
      console.error('Failed to join waitlist:', err);
    } finally {
      setIsJoiningWaitlist(false);
    }
  };

  const isPro = currentPlan === 'PRO' || currentPlan === 'UNLIMITED_PRO';
  const isStarterPack = currentPlan === 'STARTER_PACK';

  // Determine header text based on current plan
  const getHeaderText = () => {
    if (isPro) return 'Top Up Your Account';
    if (isStarterPack) return 'Get More Credits';
    return 'Get More Audits';
  };

  const getSubheaderText = () => {
    if (isPro) return 'Add more credits to your Pro subscription or upgrade to Enterprise for unlimited access.';
    if (isStarterPack) return 'Need more audits? Buy additional credits or upgrade to Pro for monthly allowance.';
    return 'Australian real estate moves fast. Get deeper insights and more audits to make confident offers.';
  };

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32">
        <div className="text-center mb-16 space-y-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium hover:text-[#C9A961] transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Home
          </button>
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter" style={{ color: 'var(--text-primary)' }}>
              {getHeaderText()}
            </h1>
            <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {getSubheaderText()}
            </p>
          </div>
        </div>

        {/* STARTER PACK USERS: Show 3-Pack | Pro | Enterprise */}
        {isStarterPack ? (
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 items-stretch">
            {/* Buy 3 More Credits */}
            <div className="p-8 rounded-[3rem] border-2 flex flex-col transition-all relative hover:border-[#C9A961]/50" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="mb-8">
                <h3 className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>3 Credit Pack</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black" style={{ color: 'var(--text-primary)' }}>$19</span>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-muted)' }}>AUD one-time</span>
                </div>
              </div>
              <ul className="space-y-3 text-sm mb-8 flex-1" style={{ color: 'var(--text-muted)' }}>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-[#C9A961] text-xs"></i>
                  <span>3 Additional Property Audits</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-[#C9A961] text-xs"></i>
                  <span>Never Expires</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-[#C9A961] text-xs"></i>
                  <span>Premium PDF Export</span>
                </li>
              </ul>
              <button 
                onClick={handleSelectStarter}
                disabled={isProcessing !== null}
                className="w-full py-3 sm:py-4 rounded-2xl font-bold uppercase tracking-widest text-[12px] sm:text-[11px] border-2 border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961] hover:text-white transition-all flex items-center justify-center gap-2"
              >
                {isProcessing === 'STARTER_PACK' ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus"></i>
                    Add 3 Credits
                  </>
                )}
              </button>
            </div>

            {/* Upgrade to Pro */}
            <div className="p-8 rounded-[3rem] border-2 border-[#C9A961] flex flex-col relative shadow-lg shadow-[#C9A961]/10" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[#C9A961] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
                  Best Value
                </span>
              </div>
              <div className="mb-8 pt-2">
                <h3 className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black" style={{ color: 'var(--text-primary)' }}>$49</span>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-muted)' }}>AUD / month</span>
                </div>
              </div>
              <ul className="space-y-3 text-sm mb-8 flex-1" style={{ color: 'var(--text-muted)' }}>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-[#C9A961] text-xs"></i>
                  <span>10 Property Audits / month</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-[#C9A961] text-xs"></i>
                  <span>Premium PDF Export</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-[#C9A961] text-xs"></i>
                  <span>Bulk credit packs – 22% off</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-[#C9A961] text-xs"></i>
                  <span>Priority Support</span>
                </li>
              </ul>
              <button 
                onClick={handleSelectPro}
                disabled={isProcessing !== null}
                className="w-full py-3 sm:py-4 rounded-2xl font-bold uppercase tracking-widest text-[12px] sm:text-[11px] bg-[#C9A961] text-white hover:bg-[#3A342D] transition-all flex items-center justify-center gap-2"
              >
                {isProcessing === 'PRO' ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-rocket"></i>
                    Upgrade to Pro
                  </>
                )}
              </button>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-[3rem] border-2 flex flex-col transition-all relative hover:border-[#C9A961]/50" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[#3A342D] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
                  Coming Soon
                </span>
              </div>
              <div className="mb-8 pt-2">
                <h3 className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Enterprise</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black" style={{ color: 'var(--text-primary)' }}>$1,200</span>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-muted)' }}>AUD / month</span>
                </div>
              </div>
              <ul className="space-y-3 text-sm mb-8 flex-1" style={{ color: 'var(--text-muted)' }}>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-[#C9A961] text-xs"></i>
                  <span>Unlimited Property Audits</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-[#C9A961] text-xs"></i>
                  <span>Qualified Leads</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-[#C9A961] text-xs"></i>
                  <span>Commercial-Use Reports</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-[#C9A961] text-xs"></i>
                  <span>Priority Compute & Support</span>
                </li>
              </ul>
              <button 
                onClick={handleJoinWaitlist}
                disabled={!isLoggedIn || waitlistJoined || isJoiningWaitlist}
                className={`w-full py-3 sm:py-4 rounded-2xl font-bold uppercase tracking-widest text-[12px] sm:text-[11px] transition-all flex items-center justify-center gap-2 ${
                  waitlistJoined 
                    ? 'bg-[#1a1a1a] text-white cursor-default' 
                    : 'border-2 hover:bg-[#C9A961] hover:text-white hover:border-[#C9A961]'
                }`}
                style={!waitlistJoined ? { borderColor: 'var(--border-color)', color: 'var(--text-muted)' } : {}}
              >
                {isJoiningWaitlist ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Joining...
                  </>
                ) : waitlistJoined ? (
                  <>
                    <i className="fa-solid fa-check"></i>
                    You're on the list!
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-bell"></i>
                    {isLoggedIn ? 'Join Waitlist' : 'Login to Join'}
                  </>
                )}
              </button>
              {waitlistJoined && (
                <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
                  We'll notify you when Enterprise launches
                </p>
              )}
            </div>
          </div>
        ) : isPro ? (
          /* PRO USERS: Show Credit Packs + Enterprise */
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 items-stretch">
            {/* 3 Credit Pack */}
            <div className="p-8 rounded-[3rem] border-2 flex flex-col transition-all relative hover:border-[#C9A961]/50" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="mb-8">
                <h3 className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>3 Pack</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black" style={{ color: 'var(--text-primary)' }}>$19</span>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-muted)' }}>AUD</span>
                </div>
                <p className="text-[11px] sm:text-xs font-medium mt-2" style={{ color: 'var(--text-muted)' }}>No subscription. Buy when you need.</p>
              </div>
              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-start gap-3 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-bolt mt-1 text-[#C9A961]"></i>
                  +3 Property Audits
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Credits never expire
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Added to balance
                </li>
              </ul>
              <button
                onClick={handleSelectStarter}
                disabled={isProcessing !== null}
                className="w-full py-3 sm:py-4 rounded-2xl font-bold uppercase tracking-widest text-[12px] sm:text-[11px] border-2 border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961] hover:text-white transition-all flex items-center justify-center gap-2"
              >
                {isProcessing === 'STARTER_PACK' ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-bolt"></i>
                    Buy 3 Credits
                  </>
                )}
              </button>
            </div>

            {/* 20 Credit Pack - Best Value */}
            <div className="p-8 rounded-[3rem] border-2 border-[#C9A961] shadow-2xl flex flex-col transition-all relative transform hover:scale-[1.02]" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-[#C9A961] text-white px-3 sm:px-4 py-1 rounded-full text-[11px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                  Best Value
                </span>
              </div>
              <div className="mb-8">
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-primary)' }}>20 Pack</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-black" style={{ color: 'var(--text-primary)' }}>$99</span>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-muted)' }}>AUD</span>
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-[#C9A961] mt-2">Best value – Save 22%</p>
              </div>
              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-start gap-3 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-bolt mt-1 text-[#C9A961]"></i>
                  +20 Property Audits
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Credits never expire
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Added to balance
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Best for active investors
                </li>
              </ul>
              <button
                onClick={handleSelectBulkPack}
                disabled={isProcessing !== null}
                className="w-full py-4 sm:py-5 rounded-2xl font-bold uppercase tracking-widest text-[13px] sm:text-[12px] bg-[#C9A961] text-white hover:bg-[#3A342D] shadow-xl shadow-[#C9A961]/30 transition-all flex items-center justify-center gap-2"
              >
                {isProcessing === ('BULK_PACK' as PlanType) ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-bolt"></i>
                    Buy 20 Credits
                  </>
                )}
              </button>
              <div className="mt-4 flex items-center justify-center gap-4 text-lg" style={{ color: 'var(--text-muted)' }}>
                <i className="fa-brands fa-apple-pay"></i>
                <i className="fa-brands fa-cc-visa"></i>
                <i className="fa-brands fa-cc-mastercard"></i>
                <i className="fa-solid fa-lock text-[10px]"></i>
              </div>
            </div>

            {/* Enterprise - Coming Soon (PRO users only) */}
            <div className="p-8 rounded-[3rem] border-2 flex flex-col relative" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-[#3A342D] to-[#4A4137] text-white px-3 sm:px-4 py-1 rounded-full text-[11px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                  Coming Soon
                </span>
              </div>
              
              <div className="mb-8">
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-primary)' }}>Enterprise</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-black" style={{ color: 'var(--text-primary)' }}>$1,200</span>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-muted)' }}>AUD / month</span>
                </div>
                <p className="text-[11px] sm:text-xs font-bold mt-2" style={{ color: 'var(--text-muted)' }}>For Buyers Agents & Real Estate Professionals</p>
              </div>

              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-start gap-3 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-infinity mt-1 text-[#C9A961]"></i>
                  Unlimited Property Audits
                </li>
                <li className="flex items-start gap-3 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-user-check mt-1 text-[#C9A961]"></i>
                  Qualified Leads
                </li>
                <li className="flex items-start gap-3 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-file-contract mt-1 text-[#C9A961]"></i>
                  Commercial-Use Reports
                </li>
                <li className="flex items-start gap-3 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-bolt mt-1 text-[#C9A961]"></i>
                  Priority Compute & Support
                </li>
              </ul>

              <button
                onClick={handleJoinWaitlist}
                disabled={!userId || waitlistJoined || isJoiningWaitlist}
                className={`w-full py-4 sm:py-5 rounded-2xl font-bold uppercase tracking-widest text-[13px] sm:text-[12px] border-2 transition-all flex items-center justify-center gap-3 ${
                  waitlistJoined 
                    ? 'bg-[#3A342D] text-white border-[#3A342D]' 
                    : !userId 
                      ? 'cursor-not-allowed opacity-60' 
                      : 'hover:border-[#C9A961] hover:text-[#C9A961]'
                }`}
                style={waitlistJoined ? {} : { borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
              >
                {isJoiningWaitlist ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Joining...
                  </>
                ) : waitlistJoined ? (
                  <>
                    <i className="fa-solid fa-check"></i>
                    You're on the list!
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-building"></i>
                    Join Waitlist
                  </>
                )}
              </button>
              <p className="mt-4 text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {waitlistJoined ? "We'll notify you when Enterprise launches" : "Be first to access when we launch"}
              </p>
            </div>
          </div>
        ) : (
          /* NON-PRO USERS: Show Trial | Starter Pack | Pro */
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 items-stretch">
            {/* Free Trial - Sign up */}
            <div className="p-8 rounded-[3rem] border-2 flex flex-col hover:border-[#C9A961]/50 transition-all" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="mb-8">
                <h3 className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Trial</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black" style={{ color: 'var(--text-primary)' }}>FREE</span>
                </div>
                <p className="text-[11px] sm:text-xs font-medium mt-2" style={{ color: 'var(--text-muted)' }}>Sign up to get started</p>
              </div>
              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-start gap-3 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-gift mt-1 text-[#C9A961]"></i>
                  2 Property Audits
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Full Intelligence Reports
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Value-add Strategies
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  No credit card required
                </li>
              </ul>
              <button
                onClick={onSignUp}
                disabled={isLoggedIn}
                className="w-full py-3 sm:py-4 rounded-2xl font-bold uppercase tracking-widest text-[12px] sm:text-[11px] border-2 border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961] hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoggedIn ? (
                  <>
                    <i className="fa-solid fa-check"></i>
                    Already Signed Up
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-user-plus"></i>
                    Create Free Account
                  </>
                )}
              </button>
            </div>

            {/* Starter Pack - One-time purchase */}
            <div className="p-8 rounded-[3rem] border-2 flex flex-col hover:border-[#C9A961]/50 transition-all" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="mb-8">
                <h3 className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Starter Pack</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black" style={{ color: 'var(--text-primary)' }}>$19</span>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-muted)' }}>AUD one-time</span>
                </div>
                <p className="text-[11px] sm:text-xs font-medium mt-2" style={{ color: 'var(--text-muted)' }}>No subscription. Buy when you need.</p>
              </div>
              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-start gap-3 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-bolt mt-1 text-[#C9A961]"></i>
                  3 Property Audits
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Full Intelligence Reports
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Value-add Strategies
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Credits never expire
                </li>
              </ul>
              <button
                onClick={handleSelectStarter}
                disabled={isProcessing !== null}
                className="w-full py-3 sm:py-4 rounded-2xl font-bold uppercase tracking-widest text-[12px] sm:text-[11px] border-2 border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961] hover:text-white transition-all flex items-center justify-center gap-2"
              >
                {isProcessing === 'STARTER_PACK' ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-bolt"></i>
                    Buy 3 Audits
                  </>
                )}
              </button>
            </div>

            {/* Pro Subscription */}
            <div className="p-8 rounded-[3rem] border-2 border-[#C9A961] shadow-2xl relative flex flex-col transform hover:scale-[1.02] transition-all" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-[#C9A961] text-white px-3 sm:px-4 py-1 rounded-full text-[11px] sm:text-[10px] font-black uppercase tracking-widest">
                  Best Value
                </span>
              </div>
              
              <div className="mb-8">
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-primary)' }}>Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-black" style={{ color: 'var(--text-primary)' }}>$49</span>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-muted)' }}>AUD / month</span>
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-[#C9A961] mt-2 italic">Cancel anytime. No lock-in.</p>
              </div>

              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-start gap-3 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-circle-check mt-1 text-[#C9A961]"></i>
                  10 Audits Per Month
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-file-pdf mt-1 text-[#C9A961]"></i>
                  Premium PDF Export
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Development Scenario Feasibility
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                  Risk & "Watch Out" Identification
                </li>
                <li className="flex items-start gap-3 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-tags mt-1 text-[#C9A961]"></i>
                  Bulk credit packs – 22% off
                </li>
              </ul>

              <button
                onClick={handleSelectPro}
                disabled={isProcessing !== null}
                className="w-full py-4 sm:py-5 rounded-2xl font-bold uppercase tracking-widest text-[13px] sm:text-[12px] bg-[#C9A961] text-white hover:bg-[#3A342D] shadow-xl shadow-[#C9A961]/30 transition-all flex items-center justify-center gap-3"
              >
                {isProcessing === 'PRO' ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Processing Secure Payment...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-crown"></i>
                    Subscribe to Pro
                  </>
                )}
              </button>
              <div className="mt-4 flex items-center justify-center gap-4 text-lg" style={{ color: 'var(--text-muted)' }}>
                <i className="fa-brands fa-apple-pay"></i>
                <i className="fa-brands fa-cc-visa"></i>
                <i className="fa-brands fa-cc-mastercard"></i>
                <i className="fa-solid fa-lock text-[10px]"></i>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[11px] sm:text-[10px] italic leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            All reports are indicative. Upblock.ai does not provide financial or legal advice. Pricing is in Australian Dollars (AUD) and includes GST where applicable. 
            {onShowTerms && (
              <>
                {' '}See our{' '}
                <button 
                  onClick={onShowTerms}
                  className="underline hover:text-[#C9A961] transition-colors"
                >
                  Terms & Conditions
                </button>.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
