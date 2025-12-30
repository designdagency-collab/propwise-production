import React from 'react';
import { PlanType } from '../types';

interface NavbarProps {
  plan?: PlanType;
  onUpgrade?: () => void;
  onHome?: () => void;
  onLogin?: () => void;
  onLogout?: () => void;
  isLoggedIn?: boolean;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  plan = 'FREE', 
  onUpgrade, 
  onHome, 
  onLogin, 
  onLogout, 
  isLoggedIn = false,
  userName,
  userEmail,
  userPhone,
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <button 
            onClick={onHome}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none group"
          >
            <div className="relative flex items-center justify-center w-10 h-10 transition-transform group-active:scale-95">
              {/* Hexagon with magnifying glass and houses */}
              <div className="w-10 h-10 bg-[#E8B84A] flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass text-[#3A342D] text-lg"></i>
                  <i className="fa-solid fa-house text-[8px] text-[#4A7AB8] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></i>
                </div>
              </div>
            </div>
            <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              blockcheck<span className="text-[#E8B84A]">.ai</span>
            </span>
          </button>
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button 
              onClick={onToggleTheme}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2.5 transition-colors rounded-xl"
              style={{ color: 'var(--text-muted)' }}
            >
              <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-lg`}></i>
            </button>
            
            <button 
              onClick={handleSelectKey}
              title="API Key Settings"
              className="p-2.5 transition-colors rounded-xl"
              style={{ color: 'var(--text-muted)' }}
            >
              <i className="fa-solid fa-key"></i>
            </button>
            <div className="hidden md:flex items-center space-x-6 border-r pr-6" style={{ borderColor: 'var(--border-color)' }}>
               <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                 Tier: <span className={plan === 'FREE' ? 'opacity-60' : 'text-[#C9A961]'}>
                   {plan === 'FREE' ? 'Standard Access' : plan === 'BUYER_PACK' ? 'Buyer Pack' : 'Propwise Monitor'}
                 </span>
               </span>
            </div>
            
            {/* Login/Logout Button */}
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                {/* Avatar circle with initial */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center border" style={{ backgroundColor: 'var(--accent-gold-light)', borderColor: 'var(--border-input)' }}>
                  <span className="text-sm font-bold text-[#C9A961]">{getInitials()}</span>
                </div>
                {/* Display name */}
                <span className="hidden sm:inline text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {getDisplayName()}
                </span>
                <button
                  onClick={onLogout}
                  className="p-2.5 hover:text-red-500 transition-colors rounded-xl"
                  style={{ color: 'var(--text-muted)' }}
                  title="Logout"
                >
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="px-4 py-2 hover:text-[#C9A961] text-[11px] font-bold uppercase tracking-widest transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                Login
              </button>
            )}

            {plan === 'FREE' ? (
              <button 
                onClick={onUpgrade}
                className="px-6 py-2.5 bg-[#C9A961] text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-[#3A342D] transition-all shadow-md active:scale-95"
              >
                View Pricing
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border" style={{ backgroundColor: 'var(--accent-gold-light)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}>
                <i className="fa-solid fa-crown text-[#C9A961]"></i>
                Premium
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;