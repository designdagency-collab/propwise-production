import React from 'react';
import { PlanType } from '../types';

interface PricingProps {
  currentPlan?: PlanType;
  onUpgrade: (plan: PlanType) => void;
  onBack: () => void;
}

const Pricing: React.FC<PricingProps> = ({ currentPlan = 'FREE', onUpgrade, onBack }) => {
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);

  const handleSelectPlan = async () => {
    if (currentPlan === 'BUYER_PACK') return;
    setIsProcessing(true);
    try {
      await onUpgrade('BUYER_PACK');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32">
        <div className="text-center mb-16 space-y-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#3A342D]/60 hover:text-[#C9A961] transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Home
          </button>
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-[#3A342D]">
              Continued Access
            </h1>
            <p className="text-lg text-[#3A342D]/40 max-w-2xl mx-auto leading-relaxed">
              Australian real estate moves fast. Avoid a $50,000 mistake with deeper insights and unlimited property audits.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 items-stretch">
          {/* Free Tier Info */}
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 flex flex-col">
            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#3A342D]/40 uppercase tracking-widest mb-2">Standard</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-[#3A342D]/40">$0</span>
                <span className="text-sm text-[#3A342D]/30">/ month</span>
              </div>
            </div>
            <ul className="space-y-4 mb-10 flex-grow">
              <li className="flex items-start gap-3 text-slate-400 line-through text-sm">
                <i className="fa-solid fa-check mt-1"></i>
                Unlimited audits
              </li>
              <li className="flex items-start gap-3 text-slate-500 text-sm">
                <i className="fa-solid fa-check mt-1"></i>
                Basic zoning insights
              </li>
              <li className="flex items-start gap-3 text-slate-500 text-sm">
                <i className="fa-solid fa-check mt-1"></i>
                Value-add pathways
              </li>
              <li className="flex items-start gap-3 text-slate-400 text-sm font-medium">
                <i className="fa-solid fa-xmark mt-1 text-slate-300"></i>
                Limited to 3 free audits
              </li>
            </ul>
            <button disabled className="w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] bg-slate-50 text-slate-400 cursor-not-allowed">
              Current Plan
            </button>
          </div>

          {/* Paid Tier (Propwise Unlimited) */}
          <div className="bg-white p-10 rounded-[3rem] border-2 border-[#C9A961] shadow-2xl relative flex flex-col transform hover:scale-[1.02] transition-all">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-[#C9A961] text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Recommended
              </span>
            </div>
            
            <div className="mb-8">
              <h3 className="text-2xl font-black text-[#3A342D] uppercase tracking-widest mb-2">Unlimited</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-[#3A342D]">$49</span>
                <span className="text-sm text-[#3A342D]/40 font-bold">AUD / month</span>
              </div>
              <p className="text-xs font-bold text-[#C9A961] mt-2 italic">Cancel anytime. No lock-in.</p>
            </div>

            <ul className="space-y-4 mb-10 flex-grow">
              <li className="flex items-start gap-3 text-[#3A342D] font-bold text-sm">
                <i className="fa-solid fa-circle-check mt-1 text-[#C9A961]"></i>
                Unlimited Property Audits
              </li>
              <li className="flex items-start gap-3 text-[#3A342D]/70 text-sm">
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                Deep Intelligence Analysis
              </li>
              <li className="flex items-start gap-3 text-[#3A342D]/70 text-sm">
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                Development Scenario Feasibility
              </li>
              <li className="flex items-start gap-3 text-[#3A342D]/70 text-sm">
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                Recent Comparable Sales Records
              </li>
              <li className="flex items-start gap-3 text-[#3A342D]/70 text-sm">
                <i className="fa-solid fa-check mt-1 text-[#C9A961]"></i>
                Risk & "Watch Out" Identification
              </li>
            </ul>

            <button
              onClick={handleSelectPlan}
              disabled={isProcessing || currentPlan === 'BUYER_PACK'}
              className="w-full py-5 rounded-2xl font-bold uppercase tracking-widest text-[12px] bg-[#C9A961] text-white hover:bg-[#3A342D] shadow-xl shadow-[#C9A961]/30 transition-all flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Processing Secure Payment...
                </>
              ) : currentPlan === 'BUYER_PACK' ? (
                'Active Plan'
              ) : (
                'Unlock Unlimited Access'
              )}
            </button>
            <div className="mt-4 flex items-center justify-center gap-4 text-[#3A342D]/20 text-lg">
              <i className="fa-brands fa-apple-pay"></i>
              <i className="fa-brands fa-cc-visa"></i>
              <i className="fa-brands fa-cc-mastercard"></i>
              <i className="fa-solid fa-lock text-[10px]"></i>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[10px] text-[#3A342D]/30 italic leading-relaxed">
            All reports are indicative. Propwise does not provide financial or legal advice. Pricing is in Australian Dollars (AUD) and includes GST where applicable.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
