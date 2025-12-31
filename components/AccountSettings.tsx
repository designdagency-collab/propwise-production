import React, { useState } from 'react';
import { PlanType, CreditState } from '../types';

interface SearchHistoryItem {
  address: string;
  created_at: string;
}

interface AccountSettingsProps {
  plan: PlanType;
  creditState: CreditState;
  remainingCredits: number;
  userEmail?: string;
  isLoggedIn: boolean;
  searchHistory: SearchHistoryItem[];
  onBack: () => void;
  onCancelSubscription: () => Promise<void>;
  onLogout: () => void | Promise<void>;
  onSearchAddress: (address: string) => void;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({
  plan,
  creditState,
  remainingCredits,
  userEmail,
  isLoggedIn,
  searchHistory,
  onBack,
  onCancelSubscription,
  onLogout,
  onSearchAddress
}) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      await onCancelSubscription();
      setCancelSuccess(true);
      setShowCancelConfirm(false);
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  const getPlanName = () => {
    switch (plan) {
      case 'PRO': return 'Pro';
      case 'UNLIMITED_PRO': return 'Unlimited Pro';
      case 'STARTER_PACK': return 'Starter Pack';
      default: return 'Free Trial';
    }
  };

  const isPaidPlan = plan === 'PRO' || plan === 'UNLIMITED_PRO';

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-32">
        <div className="mb-8">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium hover:text-[#C9A961] transition-colors mb-8"
            style={{ color: 'var(--text-muted)' }}
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Home
          </button>
          
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter" style={{ color: 'var(--text-primary)' }}>
            Account Settings
          </h1>
        </div>

        {!isLoggedIn ? (
          <div className="text-center py-12 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <i className="fa-solid fa-user-slash text-4xl mb-4" style={{ color: 'var(--text-muted)' }}></i>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Please log in to view account settings.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Account Info */}
            <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                Account
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Email</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{userEmail || 'Not set'}</span>
                </div>
              </div>
            </div>

            {/* Subscription Info */}
            <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                Subscription
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Current Plan</span>
                  <span className={`text-sm font-bold ${isPaidPlan ? 'text-[#C9A961]' : ''}`} style={{ color: isPaidPlan ? undefined : 'var(--text-primary)' }}>
                    {getPlanName()}
                    {isPaidPlan && <i className="fa-solid fa-crown ml-2 text-xs"></i>}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Audits Remaining</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {plan === 'UNLIMITED_PRO' ? '∞ Unlimited' : remainingCredits}
                  </span>
                </div>
                {plan === 'PRO' && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Billing Period</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {creditState.proMonth || 'Current Month'}
                    </span>
                  </div>
                )}
                {creditState.hasAccount && !isPaidPlan && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Account Bonus</span>
                    <span className="text-sm font-medium text-green-600">
                      <i className="fa-solid fa-check mr-1"></i> Applied (+1 audit)
                    </span>
                  </div>
                )}
                {creditState.creditTopups > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Purchased Credits</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {creditState.creditTopups} remaining
                    </span>
                  </div>
                )}
              </div>

              {/* Cancel Subscription Button */}
              {plan === 'PRO' && !cancelSuccess && (
                <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  {!showCancelConfirm ? (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="text-sm text-red-500 hover:text-red-600 transition-colors"
                    >
                      Cancel Subscription
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Are you sure you want to cancel? You'll lose access to Pro features at the end of your billing period.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={handleCancelSubscription}
                          disabled={isCancelling}
                          className="px-4 py-2 bg-red-500 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {isCancelling ? (
                            <>
                              <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                              Cancelling...
                            </>
                          ) : (
                            'Yes, Cancel'
                          )}
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(false)}
                          className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg border transition-colors"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                        >
                          Keep Subscription
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cancelSuccess && (
                <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-2 text-green-600">
                    <i className="fa-solid fa-check-circle"></i>
                    <span className="text-sm font-medium">
                      Subscription cancelled. You'll have access until the end of your billing period.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Search History */}
            <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                Search History
              </h2>
              
              {searchHistory.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fa-solid fa-clock-rotate-left text-2xl mb-3" style={{ color: 'var(--text-muted)' }}></i>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No searches yet. Your property audits will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchHistory.map((item, index) => {
                    const date = new Date(item.created_at);
                    const formattedDate = date.toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    });
                    
                    return (
                      <button
                        key={index}
                        onClick={() => onSearchAddress(item.address)}
                        className="w-full flex items-center justify-between p-3 rounded-xl border transition-all hover:border-[#C9A961] hover:shadow-sm group"
                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex items-center gap-3 text-left min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#C9A961]/10 flex items-center justify-center flex-shrink-0">
                            <i className="fa-solid fa-location-dot text-[#C9A961] text-xs"></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-[#C9A961] transition-colors" style={{ color: 'var(--text-primary)' }}>
                              {item.address}
                            </p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {formattedDate}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                            Search Again
                          </span>
                          <i className="fa-solid fa-arrow-right text-[10px] text-[#C9A961] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              
              {searchHistory.length > 0 && (
                <p className="text-[10px] mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-info-circle mr-1"></i>
                  Re-searching uses 1 audit credit
                </p>
              )}
            </div>

            {/* Logout */}
            <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
              >
                <i className="fa-solid fa-right-from-bracket"></i>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSettings;

