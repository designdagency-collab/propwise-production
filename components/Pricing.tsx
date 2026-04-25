import React, { useState } from 'react';
import { PlanType } from '../types';
import { supabaseService } from '../services/supabaseService';

interface PricingProps {
  currentPlan?: PlanType;
  onUpgrade?: (plan: PlanType) => void;
  onBack: () => void;
  onShowTerms?: () => void;
  onSignUp?: () => void;
  onOpenLeadsDashboard?: () => void;
  onProfileUpdated?: () => void;
  isLoggedIn?: boolean;
  userId?: string;
  userRole?: string | null;
  isAdmin?: boolean;
}

const LEAD_REVEAL_PRICE_DEFAULT = 49;
const FREE_REVEALS = 5;

const Pricing: React.FC<PricingProps> = ({
  onBack,
  onShowTerms,
  onSignUp,
  onOpenLeadsDashboard,
  onProfileUpdated,
  isLoggedIn = false,
  userRole = null,
  isAdmin = false,
}) => {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const isSubscriber = userRole === 'subscriber' || isAdmin;

  const handleSubscriberCTA = async () => {
    if (isSubscriber) {
      onBack();
      onOpenLeadsDashboard?.();
      return;
    }

    if (!isLoggedIn) {
      // Stash intent so App.tsx can flip role after signup completes
      try {
        sessionStorage.setItem('upblock_signup_intent', 'subscriber');
      } catch {}
      onSignUp?.();
      return;
    }

    setIsUpgrading(true);
    try {
      const response = await supabaseService.authenticatedFetch('/api/profile-role', {
        method: 'POST',
        body: JSON.stringify({ role: 'subscriber' }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to upgrade');
      }
      onProfileUpdated?.();
      onBack();
      onOpenLeadsDashboard?.();
    } catch (e: any) {
      alert(`Could not upgrade: ${e.message || 'Unknown error'}`);
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-8">
        <button
          onClick={onBack}
          className="text-sm font-bold uppercase tracking-widest text-[#4A4137]/60 hover:text-[#C9A961] transition-colors mb-6"
        >
          <i className="fa-solid fa-arrow-left mr-2"></i>Back
        </button>

        <div className="text-center mb-12 sm:mb-16">
          <span className="inline-block px-4 py-1.5 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
            <i className="fa-solid fa-route mr-2"></i>
            Pick your path
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
            Free for owners.<br className="sm:hidden" /> Pay-per-lead for the trade.
          </h1>
          <p className="max-w-xl mx-auto text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
            Property owners get unlimited free reports. Developers and buyers agents pay only when they unlock a real lead — no subscription, no lock-in.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* HOMEOWNER CARD */}
          <div
            className="rounded-3xl p-8 sm:p-10 flex flex-col"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid #DCD7CE',
              boxShadow: '0 12px 32px -8px rgba(74, 65, 55, 0.08)',
            }}
          >
            <div className="mb-6">
              <span className="inline-block text-[10px] font-black uppercase tracking-widest text-[#4A4137]/50">
                Property Owner
              </span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black" style={{ color: 'var(--text-primary)' }}>
                Free
              </h2>
              <p className="mt-1 text-xs text-[#4A4137]/50 uppercase tracking-widest font-bold">
                No credit card · No sign-up
              </p>
            </div>

            <p className="text-sm text-[#4A4137]/70 mb-6">
              For homeowners exploring their property's potential.
            </p>

            <ul className="space-y-3 text-sm flex-1 mb-8" style={{ color: 'var(--text-primary)' }}>
              <li className="flex items-start gap-3">
                <i className="fa-solid fa-check text-[#C9A961] mt-1"></i>
                <span>Unlimited free property reports</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="fa-solid fa-check text-[#C9A961] mt-1"></i>
                <span>Value-add strategies & development scenarios</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="fa-solid fa-check text-[#C9A961] mt-1"></i>
                <span>Risk alerts & approval pathways</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="fa-solid fa-check text-[#C9A961] mt-1"></i>
                <span>List your property as open to offers</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="fa-solid fa-check text-[#C9A961] mt-1"></i>
                <span>Free quotes from local agents & renovators</span>
              </li>
            </ul>

            <button
              onClick={onBack}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] border-2 border-[#3A342D] text-[#3A342D] hover:bg-[#3A342D] hover:text-white transition-all"
            >
              <i className="fa-solid fa-magnifying-glass mr-2"></i>
              Search a property
            </button>
          </div>

          {/* SUBSCRIBER CARD */}
          <div
            className="relative rounded-3xl p-8 sm:p-10 flex flex-col"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '2px solid #C9A961',
              boxShadow: '0 20px 48px -12px rgba(201, 169, 97, 0.28)',
            }}
          >
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#C9A961] text-white text-[10px] font-black uppercase tracking-widest rounded-full">
              For the trade
            </span>

            <div className="mb-6 mt-2">
              <span className="inline-block text-[10px] font-black uppercase tracking-widest text-[#C9A961]">
                Developer / Buyers Agent
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <h2 className="text-3xl sm:text-4xl font-black" style={{ color: 'var(--text-primary)' }}>
                  ${LEAD_REVEAL_PRICE_DEFAULT}
                </h2>
                <span className="text-sm font-bold text-[#4A4137]/60">per lead</span>
              </div>
              <p className="mt-1 text-xs text-[#4A4137]/50 uppercase tracking-widest font-bold">
                Free to join · {FREE_REVEALS} free reveals to start
              </p>
            </div>

            <p className="text-sm text-[#4A4137]/70 mb-6">
              For developers and buyers agents sourcing properties open to offers.
            </p>

            <ul className="space-y-3 text-sm flex-1 mb-8" style={{ color: 'var(--text-primary)' }}>
              <li className="flex items-start gap-3">
                <i className="fa-solid fa-check text-[#C9A961] mt-1"></i>
                <span>Browse properties open to offers</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="fa-solid fa-check text-[#C9A961] mt-1"></i>
                <span>{FREE_REVEALS} free lead reveals to start</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="fa-solid fa-check text-[#C9A961] mt-1"></i>
                <span>Full seller contact details on reveal</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="fa-solid fa-check text-[#C9A961] mt-1"></i>
                <span>Property analysis included with each lead</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="fa-solid fa-clock text-[#4A4137]/40 mt-1"></i>
                <span className="text-[#4A4137]/60">Coming soon: advanced filters, exports, API</span>
              </li>
            </ul>

            <button
              onClick={handleSubscriberCTA}
              disabled={isUpgrading}
              className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] bg-[#C9A961] text-white hover:bg-[#B8985A] transition-all disabled:opacity-60"
            >
              {isUpgrading ? (
                <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Upgrading…</>
              ) : isSubscriber ? (
                <><i className="fa-solid fa-list-check mr-2"></i>Open Leads Dashboard</>
              ) : isLoggedIn ? (
                <><i className="fa-solid fa-arrow-right mr-2"></i>Become a Subscriber</>
              ) : (
                <><i className="fa-solid fa-user-plus mr-2"></i>Sign Up Free</>
              )}
            </button>
            <p className="text-[10px] text-center text-[#4A4137]/40 mt-3 uppercase tracking-widest font-bold">
              No upfront cost · Pay only when you reveal
            </p>
          </div>
        </div>

        <p className="mt-12 text-xs text-center max-w-3xl mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          All reports are AI-assisted, scenario-based estimates using publicly available data and do not constitute financial or legal advice. Pricing is in Australian Dollars (AUD) and includes GST where applicable.
          {onShowTerms && (
            <> See our <button onClick={onShowTerms} className="underline hover:text-[#C9A961]">Terms &amp; Conditions</button>.</>
          )}
        </p>
      </div>
    </div>
  );
};

export default Pricing;
