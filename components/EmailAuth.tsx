import React, { useState } from 'react';
import { supabaseService } from '../services/supabaseService';

type AuthMode = 'signup' | 'login' | 'forgot' | 'reset';

interface EmailAuthProps {
  onSuccess: (email: string, isNewUser: boolean) => void;
  onCancel: () => void;
  initialMode?: AuthMode;
}

const EmailAuth: React.FC<EmailAuthProps> = ({ onSuccess, onCancel, initialMode = 'signup' }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { user, error } = await supabaseService.signUpWithEmail(email, password, fullName);
      
      if (error) throw error;

      if (user) {
        onSuccess(email, true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const { user, error } = await supabaseService.signInWithEmail(email, password);
      
      if (error) throw error;

      if (user) {
        onSuccess(email, false);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabaseService.sendPasswordResetEmail(email);
      
      if (error) throw error;

      setSuccessMessage('Password reset link sent! Check your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabaseService.updatePassword(password);
      
      if (error) throw error;

      setSuccessMessage('Password updated successfully!');
      setTimeout(() => onSuccess(email, false), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Create Account';
      case 'login': return 'Welcome Back';
      case 'forgot': return 'Reset Password';
      case 'reset': return 'Set New Password';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'signup': return 'Sign up to unlock 3 more free property audits.';
      case 'login': return 'Log in to access your account and saved audits.';
      case 'forgot': return "Enter your email and we'll send you a reset link.";
      case 'reset': return 'Choose a new password for your account.';
    }
  };

  const getIcon = () => {
    switch (mode) {
      case 'signup': return 'fa-user-plus';
      case 'login': return 'fa-right-to-bracket';
      case 'forgot': return 'fa-envelope';
      case 'reset': return 'fa-key';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 md:p-12 max-w-md w-full shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="text-center space-y-5 sm:space-y-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#C9A961]/10 rounded-2xl flex items-center justify-center mx-auto">
            <i className={`fa-solid ${getIcon()} text-xl sm:text-2xl text-[#C9A961]`}></i>
          </div>
          
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#3A342D] tracking-tighter mb-2">
              {getTitle()}
            </h2>
            <p className="text-xs sm:text-sm text-[#3A342D]/60 font-medium">
              {getSubtitle()}
            </p>
          </div>

          {successMessage && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-medium">
              <i className="fa-solid fa-check-circle mr-2"></i>
              {successMessage}
            </div>
          )}

          {/* Sign Up Form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name (optional)"
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm sm:text-base transition-all"
                  disabled={isLoading}
                />
              </div>
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm sm:text-base transition-all"
                  disabled={isLoading}
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 6 characters)"
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm sm:text-base transition-all"
                  disabled={isLoading}
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm sm:text-base transition-all"
                  disabled={isLoading}
                  required
                />
              </div>

              {error && (
                <p className="text-red-500 text-xs sm:text-sm text-left">{error}</p>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 sm:py-4 bg-[#C9A961] text-white rounded-xl font-bold hover:bg-[#3A342D] transition-all uppercase tracking-widest text-[11px] sm:text-[12px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      Creating Account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  disabled={isLoading}
                  className="text-[#3A342D]/60 hover:text-[#C9A961] font-medium text-xs sm:text-sm transition-colors"
                >
                  Already have an account? <span className="font-bold">Log in</span>
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="text-[#3A342D]/40 hover:text-[#3A342D] font-medium text-xs sm:text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm sm:text-base transition-all"
                  disabled={isLoading}
                  required
                  autoFocus
                />
              </div>
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm sm:text-base transition-all"
                  disabled={isLoading}
                  required
                />
              </div>

              {error && (
                <p className="text-red-500 text-xs sm:text-sm text-left">{error}</p>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 sm:py-4 bg-[#C9A961] text-white rounded-xl font-bold hover:bg-[#3A342D] transition-all uppercase tracking-widest text-[11px] sm:text-[12px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      Logging in...
                    </>
                  ) : (
                    'Log In'
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); }}
                  disabled={isLoading}
                  className="text-[#3A342D]/60 hover:text-[#C9A961] font-medium text-xs sm:text-sm transition-colors"
                >
                  Forgot your password?
                </button>

                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); }}
                  disabled={isLoading}
                  className="text-[#3A342D]/60 hover:text-[#C9A961] font-medium text-xs sm:text-sm transition-colors"
                >
                  Don't have an account? <span className="font-bold">Sign up</span>
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="text-[#3A342D]/40 hover:text-[#3A342D] font-medium text-xs sm:text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm sm:text-base transition-all"
                  disabled={isLoading}
                  required
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-red-500 text-xs sm:text-sm text-left">{error}</p>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !!successMessage}
                  className="w-full py-3 sm:py-4 bg-[#C9A961] text-white rounded-xl font-bold hover:bg-[#3A342D] transition-all uppercase tracking-widest text-[11px] sm:text-[12px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      Sending...
                    </>
                  ) : successMessage ? (
                    <>
                      <i className="fa-solid fa-check"></i>
                      Email Sent
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
                  disabled={isLoading}
                  className="text-[#3A342D]/60 hover:text-[#C9A961] font-medium text-xs sm:text-sm transition-colors"
                >
                  Back to login
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="text-[#3A342D]/40 hover:text-[#3A342D] font-medium text-xs sm:text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Reset Password Form (shown after clicking email link) */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New Password (min 6 characters)"
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm sm:text-base transition-all"
                  disabled={isLoading}
                  required
                  autoFocus
                />
              </div>
              <div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm sm:text-base transition-all"
                  disabled={isLoading}
                  required
                />
              </div>

              {error && (
                <p className="text-red-500 text-xs sm:text-sm text-left">{error}</p>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 sm:py-4 bg-[#C9A961] text-white rounded-xl font-bold hover:bg-[#3A342D] transition-all uppercase tracking-widest text-[11px] sm:text-[12px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="text-[#3A342D]/40 hover:text-[#3A342D] font-medium text-xs sm:text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <p className="text-[10px] sm:text-[11px] text-[#3A342D]/30 leading-relaxed">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailAuth;

