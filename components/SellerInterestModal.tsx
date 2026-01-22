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
  isLoggedIn
}) => {
  const isBuyerInterest = !valueAddStrategies || valueAddStrategies.length === 0;
  const [step, setStep] = useState(isBuyerInterest ? 2 : 1); // Skip to contact if buyer interest
  const [completedImprovements, setCompletedImprovements] = useState<Set<number>>(new Set());
  const [name, setName] = useState(userProfile?.full_name || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleImprovement = (index: number) => {
    const newSet = new Set(completedImprovements);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setCompletedImprovements(newSet);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError('Please provide your name, phone number, and email');
      return;
    }

    setSubmitting(true);
    setError(null);

    // Build notes based on type
    let notesText = '';
    
    if (isBuyerInterest) {
      notesText = `BUYER INTEREST${additionalNotes ? `\n\n${additionalNotes}` : ''}`;
    } else {
      // Build improvements completed list
      const completedList = Array.from(completedImprovements).map(idx => 
        valueAddStrategies[idx]?.title || 'Unknown'
      );
      notesText = `SELLER INTEREST - Completed improvements: ${completedList.join(', ')}${additionalNotes ? `\n\nAdditional notes: ${additionalNotes}` : ''}`;
    }

    try {
      const response = await fetch('https://upblock.ai/api/seller-interest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': isLoggedIn && userProfile ? `Bearer ${await supabaseService.getAccessToken()}` : ''
        },
        body: JSON.stringify({
          propertyAddress,
          targetPrice,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          notes: notesText
        })
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to submit. Please try again.');
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err.message || 'Network error. Please try again.');
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6" onClick={(e) => e.stopPropagation()}>
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto">
            <i className="fa-solid fa-check text-green-600 text-2xl"></i>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
            <p className="text-gray-600">
              {isBuyerInterest 
                ? "We'll be in touch soon to discuss this property opportunity." 
                : "We'll be in touch soon to discuss your property sale."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Improvements Questionnaire
  if (step === 1) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-3xl p-8 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#C9A961]/10 flex items-center justify-center">
                <i className="fa-solid fa-hammer text-[#C9A961] text-xl"></i>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Property Improvements</h3>
                <p className="text-sm text-gray-500">Which improvements have you completed?</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <i className="fa-solid fa-xmark text-gray-400 text-xl"></i>
            </button>
          </div>

          {/* Property Info */}
          <div className="bg-gradient-to-r from-[#C9A961]/5 to-[#8A9A6D]/5 rounded-2xl p-6 mb-6">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Your Property</p>
              <p className="text-lg font-bold text-gray-900">{propertyAddress}</p>
              <p className="text-xs text-gray-500">Potential sale price: <span className="font-bold text-[#C9A961]">${targetPrice.toLocaleString()}</span></p>
            </div>
          </div>

          {/* Improvements Checklist */}
          <div className="space-y-3 mb-6">
            <p className="text-sm font-bold text-gray-700">Select the improvements you've already completed:</p>
            {valueAddStrategies.map((strategy, index) => (
              <label
                key={index}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  completedImprovements.has(index)
                    ? 'border-[#8A9A6D] bg-[#8A9A6D]/5'
                    : 'border-gray-200 hover:border-[#C9A961]/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={completedImprovements.has(index)}
                  onChange={() => toggleImprovement(index)}
                  className="w-5 h-5 rounded border-gray-300 text-[#8A9A6D] focus:ring-[#8A9A6D]"
                />
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{strategy.title}</p>
                  {strategy.estimatedUplift && (
                    <p className="text-xs text-gray-500">
                      Value uplift: ${strategy.estimatedUplift.low?.toLocaleString()} - ${strategy.estimatedUplift.high?.toLocaleString()}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-4 bg-[#C9A961] text-white font-bold rounded-xl hover:bg-[#B89851] transition-all uppercase tracking-widest text-sm"
            >
              Next: Contact Details
              <i className="fa-solid fa-arrow-right ml-2"></i>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Contact Details
  // Step 2: Contact Details
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isBuyerInterest ? 'bg-[#B8864A]/10' : 'bg-[#C9A961]/10'}`}>
              <i className={`fa-solid ${isBuyerInterest ? 'fa-hand-holding-dollar' : 'fa-home'} ${isBuyerInterest ? 'text-[#B8864A]' : 'text-[#C9A961]'} text-xl`}></i>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {isBuyerInterest ? 'Buyer Interest' : 'Contact Details'}
              </h3>
              <p className="text-sm text-gray-500">How can we reach you?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-xmark text-gray-400 text-xl"></i>
          </button>
        </div>

        {/* Property Info */}
        <div className={`bg-gradient-to-r rounded-2xl p-4 mb-6 ${isBuyerInterest ? 'from-[#B8864A]/5 to-[#B8864A]/10' : 'from-[#C9A961]/5 to-[#8A9A6D]/5'}`}>
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-900">{propertyAddress}</p>
            {!isBuyerInterest && completedImprovements.size > 0 && (
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-check-circle text-[#8A9A6D] text-sm"></i>
                <p className="text-xs text-gray-600">
                  {completedImprovements.size} improvement{completedImprovements.size !== 1 ? 's' : ''} completed
                </p>
              </div>
            )}
            <p className="text-xs text-gray-600">
              {isBuyerInterest ? 'Interested at' : 'Target price'}: <span className={`font-bold ${isBuyerInterest ? 'text-[#B8864A]' : 'text-[#C9A961]'}`}>${targetPrice.toLocaleString()}</span>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Your Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C9A961] focus:border-transparent"
              placeholder="Enter your name"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C9A961] focus:border-transparent"
              placeholder="+61 4XX XXX XXX"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C9A961] focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Additional Information (Optional)
            </label>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C9A961] focus:border-transparent resize-none"
              placeholder={isBuyerInterest ? "Financing ready, settlement timeline, etc..." : "Timeline, special circumstances, etc..."}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <i className="fa-solid fa-exclamation-circle text-red-500 mt-0.5"></i>
              <p className="text-sm text-red-700 flex-1">{error}</p>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            {!isBuyerInterest && (
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest text-sm"
              >
                <i className="fa-solid fa-arrow-left mr-2"></i>
                Back
              </button>
            )}
            {isBuyerInterest && (
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest text-sm"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`flex-1 py-4 bg-[#C9A961] text-white font-bold rounded-xl transition-all uppercase tracking-widest text-sm ${
                submitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#B89851]'
              }`}
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          By submitting, you agree to be contacted about selling your property.
        </p>
      </div>
    </div>
  );
};

export default SellerInterestModal;
