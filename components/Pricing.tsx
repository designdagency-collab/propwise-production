import React from 'react';
import { PlanType } from '../types';

interface PricingProps {
  currentPlan?: PlanType;
  onUpgrade: (plan: PlanType) => void;
  onBack: () => void;
  onShowTerms?: () => void;
  onSignUp?: () => void;
  isLoggedIn?: boolean;
}

const Pricing: React.FC<PricingProps> = ({ currentPlan = 'FREE_TRIAL', onUpgrade, onBack, onShowTerms, onSignUp, isLoggedIn = false }) => {
  const [isProcessing, setIsProcessing] = React.useState<PlanType | null>(null);

  const handleSelectStarter = async () => {
    setIsProcessing('STARTER_PACK');
    try {
      await onUpgrade('STARTER_PACK');
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

  const isPro = currentPlan === 'PRO' || currentPlan === 'UNLIMITED_PRO';

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
              Get More Audits
            </h1>
            <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Australian real estate moves fast. Get deeper insights and more audits to make confident offers.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 items-stretch">
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

          {/* Starter Pack - One-time purchase (highlighted for PRO users topping up) */}
          <div className={`p-8 rounded-[3rem] border-2 flex flex-col transition-all relative ${isPro ? 'border-[#C9A961] shadow-xl' : 'hover:border-[#C9A961]/50'}`} style={{ backgroundColor: 'var(--bg-card)', borderColor: isPro ? undefined : 'var(--border-color)' }}>
            {isPro && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-[#C9A961] text-white px-3 sm:px-4 py-1 rounded-full text-[11px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                  Top Up Credits
                </span>
              </div>
            )}
            <div className="mb-8">
              <h3 className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>{isPro ? 'Credit Pack' : 'Starter Pack'}</h3>
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
              className={`w-full py-3 sm:py-4 rounded-2xl font-bold uppercase tracking-widest text-[12px] sm:text-[11px] transition-all flex items-center justify-center gap-2 ${isPro ? 'bg-[#C9A961] text-white hover:bg-[#3A342D] shadow-lg' : 'border-2 border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961] hover:text-white'}`}
            >
              {isProcessing === 'STARTER_PACK' ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Processing...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-bolt"></i>
                  {isPro ? 'Add 3 Credits' : 'Buy 3 Audits'}
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
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                Deep Intelligence Analysis
              </li>
              <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                Development Scenario Feasibility
              </li>
              <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                Recent Comparable Sales Records
              </li>
              <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                Risk & "Watch Out" Identification
              </li>
            </ul>

            <button
              onClick={handleSelectPro}
              disabled={isProcessing !== null || isPro}
              className="w-full py-4 sm:py-5 rounded-2xl font-bold uppercase tracking-widest text-[13px] sm:text-[12px] bg-[#C9A961] text-white hover:bg-[#3A342D] shadow-xl shadow-[#C9A961]/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isProcessing === 'PRO' ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Processing Secure Payment...
                </>
              ) : isPro ? (
                <>
                  <i className="fa-solid fa-crown"></i>
                  Active Plan
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

          {/* Enterprise - Coming Soon */}
          <div className="p-8 rounded-[3rem] border-2 flex flex-col relative opacity-80" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-to-r from-[#3A342D] to-[#4A4137] text-white px-3 sm:px-4 py-1 rounded-full text-[11px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                Coming Soon
              </span>
            </div>
            
            <div className="mb-8">
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-primary)' }}>Enterprise</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-black" style={{ color: 'var(--text-primary)' }}>$900</span>
                <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-muted)' }}>AUD / month</span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold mt-2" style={{ color: 'var(--text-muted)' }}>For Buyers Agents & Real Estate Professionals</p>
            </div>

            <ul className="space-y-4 mb-10 flex-grow">
              <li className="flex items-start gap-3 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                <i className="fa-solid fa-users mt-1 text-[#C9A961]"></i>
                Qualified Buyer Leads
              </li>
              <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                Seller Interest Notifications
              </li>
              <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                Unlimited Property Audits
              </li>
              <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                White-label Reports
              </li>
              <li className="flex items-start gap-3 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                Priority Support
              </li>
            </ul>

            <button
              disabled
              className="w-full py-4 sm:py-5 rounded-2xl font-bold uppercase tracking-widest text-[13px] sm:text-[12px] border-2 transition-all flex items-center justify-center gap-3 cursor-not-allowed"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
            >
              <i className="fa-solid fa-building"></i>
              Join Waitlist
            </button>
            <p className="mt-4 text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Be first to access when we launch
            </p>
          </div>
        </div>

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
