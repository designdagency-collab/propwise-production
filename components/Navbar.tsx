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
  userPhone 
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
      const cleanName = namePart.replace(/[._]/g, ' ').replace(/\d+$/, '').split(' ')[0];
      return cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
    }
    return '';
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
    <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-[#C9A961]/10 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <button 
            onClick={onHome}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none group"
          >
            <div className="relative flex items-center justify-center w-10 h-10 transition-transform group-active:scale-95">
              <i className="fa-solid fa-house text-2xl text-[#C9A961]"></i>
              <div className="absolute inset-0 flex items-center justify-center pt-1">
                 <i className="fa-solid fa-dna text-[10px] text-white bg-[#3A342D] rounded-full p-0.5 shadow-sm"></i>
              </div>
            </div>
            <span className="text-2xl font-bold tracking-tighter text-[#3A342D]">
              Propwise
            </span>
          </button>
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleSelectKey}
              title="API Key Settings"
              className="p-2.5 text-[#3A342D]/40 hover:text-[#C9A961] transition-colors rounded-xl hover:bg-[#C9A961]/5"
            >
              <i className="fa-solid fa-key"></i>
            </button>
            <div className="hidden md:flex items-center space-x-6 border-r border-[#C9A961]/10 pr-6">
               <span className="text-[10px] font-bold uppercase tracking-widest text-[#3A342D]/40">
                 Tier: <span className={plan === 'FREE' ? 'opacity-60' : 'text-[#C9A961]'}>
                   {plan === 'FREE' ? 'Standard Access' : plan === 'BUYER_PACK' ? 'Buyer Pack' : 'Propwise Monitor'}
                 </span>
               </span>
            </div>
            
            {/* Login/Logout Button */}
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                {/* Avatar circle with initial */}
                <div className="w-9 h-9 bg-[#C9A961]/15 rounded-full flex items-center justify-center border border-[#C9A961]/20">
                  <span className="text-sm font-bold text-[#C9A961]">{getInitials()}</span>
                </div>
                {/* Display name */}
                <span className="hidden sm:inline text-sm font-semibold text-[#3A342D]">
                  {getDisplayName()}
                </span>
                <button
                  onClick={onLogout}
                  className="p-2.5 text-[#3A342D]/40 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"
                  title="Logout"
                >
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="px-4 py-2 text-[#3A342D]/60 hover:text-[#C9A961] text-[11px] font-bold uppercase tracking-widest transition-colors"
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
              <div className="flex items-center gap-2 px-4 py-2 bg-[#B8C5A0]/10 text-[#3A342D] rounded-xl text-[10px] font-bold uppercase tracking-widest border border-[#B8C5A0]/20">
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