import React from 'react';
import { PlanType } from '../types';
import { stripeService } from '../services/stripeService';

interface PricingProps {
  currentPlan?: PlanType;
  onUpgrade: (plan: PlanType) => void;
  onBack: () => void;
}

const Pricing: React.FC<PricingProps> = ({ currentPlan = 'FREE', onUpgrade, onBack }) => {
  const [isProcessing, setIsProcessing] = React.useState<PlanType | null>(null);

  const handleSelectPlan = async (plan: PlanType) => {
    if (plan === currentPlan) return;
    setIsProcessing(plan);
    try {
      await onUpgrade(plan);
    } finally {
      setIsProcessing(null);
    }
  };

  const plans = [
    {
      id: 'FREE' as PlanType,
      name: 'Standard Access',
      price: '$0',
      period: 'Forever',
      description: 'Perfect for occasional property research',
      features: [
        '2 property audits per day',
        'Basic property intelligence',
        'Zoning & planning insights',
        'Comparable sales data',
        'Value-add strategies',
      ],
      cta: 'Current Plan',
      popular: false,
    },
    {
      id: 'BUYER_PACK' as PlanType,
      name: 'Buyer Pack',
      price: '$29',
      period: 'per month',
      description: 'For serious property buyers and investors',
      features: [
        'Unlimited property audits',
        'Deep intelligence reports',
        'Development scenario analysis',
        'Portfolio sellout summaries',
        'Local area intelligence',
        'Priority support',
      ],
      cta: 'Get Buyer Pack',
      popular: true,
    },
    {
      id: 'MONITOR' as PlanType,
      name: 'Propwise Monitor',
      price: '$99',
      period: 'per month',
      description: 'For property professionals and developers',
      features: [
        'Everything in Buyer Pack',
        'Bulk property analysis',
        'API access',
        'Custom reporting',
        'Dedicated account manager',
        'White-label options',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

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
          <div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-[#3A342D] mb-4">
              Choose Your Plan
            </h1>
            <p className="text-lg text-[#3A342D]/40 max-w-2xl mx-auto">
              Unlock deeper property intelligence with our flexible pricing options
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isProcessingPlan = isProcessing === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-[3rem] border-2 shadow-lg transition-all duration-300 ${
                  plan.popular
                    ? 'border-[#C9A961] scale-105 md:-mt-4'
                    : 'border-slate-200 hover:border-[#C9A961]/50'
                } ${isCurrent ? 'ring-2 ring-[#C9A961] ring-offset-2' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-[#C9A961] text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-8 space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-[#3A342D] mb-2">{plan.name}</h3>
                    <p className="text-sm text-[#3A342D]/60 mb-4">{plan.description}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-[#3A342D]">{plan.price}</span>
                      <span className="text-sm text-[#3A342D]/40">{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <i className="fa-solid fa-check text-[#C9A961] mt-1 flex-shrink-0"></i>
                        <span className="text-sm text-[#3A342D]/70">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrent || isProcessingPlan}
                    className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] transition-all ${
                      isCurrent
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : plan.popular
                        ? 'bg-[#C9A961] text-white hover:bg-[#3A342D] shadow-lg shadow-[#C9A961]/20'
                        : 'bg-[#3A342D] text-white hover:bg-[#C9A961]'
                    } ${isProcessingPlan ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    {isProcessingPlan ? (
                      <span className="flex items-center justify-center gap-2">
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        Processing...
                      </span>
                    ) : isCurrent ? (
                      plan.cta
                    ) : (
                      plan.cta
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-[#C9A961]/10">
            <h3 className="text-xl font-bold text-[#3A342D] mb-4">Frequently Asked Questions</h3>
            <div className="space-y-4 text-left">
              <div>
                <p className="font-bold text-[#3A342D] mb-1">Can I change plans later?</p>
                <p className="text-sm text-[#3A342D]/60">
                  Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </div>
              <div>
                <p className="font-bold text-[#3A342D] mb-1">What payment methods do you accept?</p>
                <p className="text-sm text-[#3A342D]/60">
                  We accept all major credit cards and debit cards through our secure Stripe payment gateway.
                </p>
              </div>
              <div>
                <p className="font-bold text-[#3A342D] mb-1">Is there a free trial?</p>
                <p className="text-sm text-[#3A342D]/60">
                  Yes! The Standard Access plan is free forever with 2 audits per day.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;