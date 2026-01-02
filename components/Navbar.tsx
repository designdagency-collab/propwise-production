import React from 'react';
import { PlanType } from '../types';

interface NavbarProps {
  plan?: PlanType;
  remainingCredits?: number;
  onUpgrade?: () => void;
  onHome?: () => void;
  onLogin?: () => void;
  onLogout?: () => void;
  onAccountSettings?: () => void;
  isLoggedIn?: boolean;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  phoneVerified?: boolean;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  plan = 'FREE_TRIAL', 
  remainingCredits = 0,
  onUpgrade, 
  onHome, 
  onLogin, 
  onLogout,
  onAccountSettings,
  isLoggedIn = false,
  userName,
  userEmail,
  userPhone,
  phoneVerified,
  isDarkMode = false,
  onToggleTheme
}) => {
  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
    }
  };

  // Get display name (first name from full name, or from email)
  const getDisplayName = () => {
    if (userName) {
      // Get first name only
      return userName.split(' ')[0];
    }
    if (userEmail) {
      // Get name part before @ and capitalize first letter
      const namePart = userEmail.split('@')[0];
      // Clean up: remove dots, underscores, numbers at end
      const parts = namePart.replace(/[._]/g, ' ').replace(/\d+$/, '').split(' ').filter(p => p.length > 1);
      // Use the longest part (e.g., "sullivan" from "b.sullivan")
      const bestPart = parts.sort((a, b) => b.length - a.length)[0] || '';
      if (bestPart.length > 1) {
        return bestPart.charAt(0).toUpperCase() + bestPart.slice(1).toLowerCase();
      }
    }
    return ''; // Return empty if no good name found - just show avatar
  };

  // Get initials for avatar
  const getInitials = () => {
    const name = userName || userEmail?.split('@')[0] || '';
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  // Format phone for display (show last 4 digits)
  const formatPhone = (phone: string) => {
    if (!phone) return '';
    return `••••${phone.slice(-4)}`;
  };

  return (
    <nav 
      className="fixed top-0 left-0 right-0 backdrop-blur-xl border-b z-50"
      style={{ 
        backgroundColor: isDarkMode ? 'rgba(18, 18, 18, 0.9)' : 'rgba(255, 255, 255, 0.8)',
        borderColor: 'var(--border-color)'
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          {/* Logo - smaller on mobile */}
          <button 
            onClick={onHome}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none group flex-shrink-0"
          >
            <img 
              src="/upblock.ai-logo.png" 
              alt="upblock.ai" 
              className="w-[130px] h-[66px] sm:w-[145px] sm:h-[74px] md:w-[155px] md:h-[80px] object-contain transition-transform group-active:scale-95"
            />
          </button>
          
          <div className="flex items-center space-x-1 sm:space-x-3">
            {/* Theme Toggle */}
            <button 
              onClick={onToggleTheme}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-1.5 sm:p-2.5 transition-colors rounded-xl"
              style={{ color: 'var(--text-muted)' }}
            >
              <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-sm sm:text-lg`}></i>
            </button>
            
            {/* API Key - hidden on mobile */}
            <button 
              onClick={handleSelectKey}
              title="API Key Settings"
              className="hidden sm:flex p-2.5 transition-colors rounded-xl"
              style={{ color: 'var(--text-muted)' }}
            >
              <i className="fa-solid fa-key"></i>
            </button>
            
            {/* Credits indicator */}
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border" style={{ backgroundColor: 'var(--accent-gold-light)', borderColor: 'var(--border-input)' }}>
              <i className="fa-solid fa-bolt text-[#C9A961] text-[10px] sm:text-xs"></i>
              <span className="text-[10px] sm:text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>
                {plan === 'UNLIMITED_PRO' ? '∞' : remainingCredits}
              </span>
              <span className="hidden sm:inline text-[9px] font-medium opacity-50" style={{ color: 'var(--text-muted)' }}>
                left
              </span>
            </div>
            
            {/* Tier badge - hidden on mobile */}
            <div className="hidden lg:flex items-center space-x-6 border-r pr-6" style={{ borderColor: 'var(--border-color)' }}>
               <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                 Tier: <span className={(plan === 'PRO' || plan === 'UNLIMITED_PRO' || plan === 'STARTER_PACK') ? 'text-[#C9A961]' : 'opacity-60'}>
                   {plan === 'PRO' ? 'Pro' : plan === 'UNLIMITED_PRO' ? 'Unlimited' : plan === 'STARTER_PACK' ? 'Starter Pack' : 'Free Trial'}
                 </span>
               </span>
            </div>
            
            {/* Login/Logout Button */}
            {isLoggedIn ? (
              <div className="flex items-center gap-1 sm:gap-3">
                {/* Avatar circle with initial - clickable for account settings */}
                <button
                  onClick={onAccountSettings}
                  className="relative w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border hover:border-[#C9A961] transition-colors"
                  style={{ backgroundColor: 'var(--accent-gold-light)', borderColor: 'var(--border-input)' }}
                  title="Account Settings"
                >
                  <span className="text-xs sm:text-sm font-bold text-[#C9A961]">{getInitials()}</span>
                  {/* Notification indicator when phone not verified */}
                  {isLoggedIn && !phoneVerified && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                      <span className="text-[8px] font-bold text-white">!</span>
                    </span>
                  )}
                </button>
                {/* Display name - hidden on mobile, clickable */}
                <button
                  onClick={onAccountSettings}
                  className="hidden md:inline text-sm font-semibold hover:text-[#C9A961] transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {getDisplayName()}
                </button>
                <button
                  onClick={onLogout}
                  className="p-1.5 sm:p-2.5 hover:text-red-500 transition-colors rounded-xl"
                  style={{ color: 'var(--text-muted)' }}
                  title="Logout"
                >
                  <i className="fa-solid fa-right-from-bracket text-sm sm:text-base"></i>
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="px-2 sm:px-4 py-1.5 sm:py-2 hover:text-[#C9A961] text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                Login
              </button>
            )}

            {/* Show badge/button based on plan - all clickable to pricing */}
            {(plan === 'PRO' || plan === 'UNLIMITED_PRO' || plan === 'STARTER_PACK') && remainingCredits <= 1 ? (
              // Low credits - show urgent Top Up button (pulsing)
              <button 
                onClick={onUpgrade}
                className="px-3 sm:px-6 py-2 sm:py-2.5 bg-[#C9A961] text-white text-[9px] sm:text-[11px] font-bold uppercase tracking-widest rounded-lg sm:rounded-xl hover:bg-[#3A342D] transition-all shadow-md active:scale-95 animate-pulse"
              >
                <i className="fa-solid fa-bolt mr-1 sm:mr-2"></i>
                <span className="hidden sm:inline">Top Up</span>
                <span className="sm:hidden">Top Up</span>
              </button>
            ) : (plan === 'PRO' || plan === 'UNLIMITED_PRO' || plan === 'STARTER_PACK') ? (
              // PRO or Starter Pack user - show View Pricing button to buy more credits
              <button 
                onClick={onUpgrade}
                className="px-3 sm:px-6 py-2 sm:py-2.5 bg-[#C9A961] text-white text-[9px] sm:text-[11px] font-bold uppercase tracking-widest rounded-lg sm:rounded-xl hover:bg-[#3A342D] transition-all shadow-md active:scale-95"
              >
                <span className="hidden sm:inline">View Pricing</span>
                <span className="sm:hidden">Pricing</span>
              </button>
            ) : (
              <button 
                onClick={onUpgrade}
                className="px-3 sm:px-6 py-2 sm:py-2.5 bg-[#C9A961] text-white text-[9px] sm:text-[11px] font-bold uppercase tracking-widest rounded-lg sm:rounded-xl hover:bg-[#3A342D] transition-all shadow-md active:scale-95"
              >
                <span className="hidden sm:inline">View Pricing</span>
                <span className="sm:hidden">Pricing</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;