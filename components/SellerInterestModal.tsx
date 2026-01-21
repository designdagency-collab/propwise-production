import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';

interface SellerInterestModalProps {
  onClose: () => void;
  propertyAddress: string;
  targetPrice: number;
  userProfile: any;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
}

const SellerInterestModal: React.FC<SellerInterestModalProps> = ({
  onClose,
  propertyAddress,
  targetPrice,
  userProfile,
  isLoggedIn,
  onLoginRequired
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form from user profile
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.full_name || '');
      setPhone(userProfile.phone || '');
      setEmail(userProfile.email || '');
    }
  }, [userProfile]);

  // Check if logged in
  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[#C9A961]/10 flex items-center justify-center mx-auto">
              <i className="fa-solid fa-user-plus text-[#C9A961] text-2xl"></i>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Create an Account</h3>
              <p className="text-gray-600">Sign up to express interest in selling your property</p>
            </div>
            <button
              onClick={() => {
                onClose();
                onLoginRequired();
              }}
              className="w-full py-4 bg-[#C9A961] text-white font-bold rounded-xl hover:bg-[#B8985 1] transition-all uppercase tracking-widest text-sm"
            >
              Create Free Account
            </button>
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await supabaseService.authenticatedFetch('/api/seller-interest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyAddress,
          targetPrice,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          notes: notes.trim()
        })
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
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
            <p className="text-gray-600">Your interest has been recorded. We'll be in touch soon.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#C9A961]/10 flex items-center justify-center">
              <i className="fa-solid fa-home text-[#C9A961] text-xl"></i>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Interested in Selling?</h3>
              <p className="text-sm text-gray-500">Let us know about your property</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-xmark text-gray-400 text-xl"></i>
          </button>
        </div>

        {/* Property Details */}
        <div className="bg-gradient-to-r from-[#C9A961]/5 to-[#C9A961]/10 rounded-2xl p-6 mb-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Property Address</p>
              <p className="text-lg font-bold text-gray-900">{propertyAddress}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Target Sale Price</p>
              <p className="text-2xl font-black text-[#C9A961]">
                ${targetPrice.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Based on minor post-improvement value</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C9A961] focus:border-transparent"
              placeholder="Enter your full name"
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

          {/* Phone */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C9A961] focus:border-transparent"
              placeholder="+61 4XX XXX XXX"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C9A961] focus:border-transparent resize-none"
              placeholder="Tell us about your property, timeline, or any other details..."
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <i className="fa-solid fa-exclamation-circle text-red-500 mt-0.5"></i>
              <p className="text-sm text-red-700 flex-1">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
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
                'Submit Interest'
              )}
            </button>
          </div>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          By submitting, you agree to be contacted about your property sale interest.
        </p>
      </div>
    </div>
  );
};

export default SellerInterestModal;
