import React, { useState } from 'react';
import { supabaseService } from '../services/supabaseService';

type AuthMode = 'signup' | 'login' | 'forgot' | 'reset';

interface EmailAuthProps {
  onSuccess: (email: string, isNewUser: boolean) => void;
  onCancel: () => void;
  onShowTerms?: () => void;
  initialMode?: AuthMode;
}

const EmailAuth: React.FC<EmailAuthProps> = ({ onSuccess, onCancel, onShowTerms, initialMode = 'signup' }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    
    try {
      const { error } = await supabaseService.signInWithGoogle();
      if (error) throw error;
      // Redirect happens automatically
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
      setIsGoogleLoading(false);
    }
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
      const { user, session, error } = await supabaseService.signInWithEmail(email, password);
      
      if (error) throw error;

      if (user && session) {
        onSuccess(email, false);
      } else if (user && !session) {
        // User exists but email not confirmed
        setError('Please confirm your email before logging in. Check your inbox for the confirmation link.');
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      // Handle specific Supabase error messages
      const message = err.message || 'Invalid email or password';
      if (message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (message.includes('Email not confirmed')) {
        setError('Please confirm your email before logging in. Check your inbox.');
      } else {
        setError(message);
      }
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4">
      <div className="rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-8 md:p-12 max-w-md w-full shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#C9A961]/10 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto">
            <i className={`fa-solid ${getIcon()} text-lg sm:text-2xl text-[#C9A961]`}></i>
          </div>
          
          <div>
            <h2 className="text-xl sm:text-3xl font-bold tracking-tighter mb-1 sm:mb-2" style={{ color: 'var(--text-primary)' }}>
              {getTitle()}
            </h2>
            <p className="text-[11px] sm:text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
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
            <form onSubmit={handleSignUp} className="space-y-3 sm:space-y-4">
              <div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name (optional)"
                  className="w-full px-4 py-2.5 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm transition-all"
                  disabled={isLoading}
                />
              </div>
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full px-4 py-2.5 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm transition-all"
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
                  className="w-full px-4 py-2.5 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm transition-all"
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
                  className="w-full px-4 py-2.5 sm:py-3.5 rounded-xl border-2 border-[#C9A961]/20 focus:border-[#C9A961] focus:outline-none text-[#3A342D] font-medium text-sm transition-all"
                  disabled={isLoading}
                  required
                />
              </div>

              {error && (
                <p className="text-red-500 text-xs text-left">{error}</p>
              )}

              <div className="flex flex-col gap-2 sm:gap-3 pt-1 sm:pt-2">
                <button
                  type="submit"
                  disabled={isLoading || isGoogleLoading}
                  className="w-full py-2.5 sm:py-4 bg-[#C9A961] text-white rounded-xl font-bold hover:bg-[#3A342D] transition-all uppercase tracking-widest text-[10px] sm:text-[12px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

                <div className="flex items-center gap-3 my-1 sm:my-2">
                  <div className="flex-1 h-px bg-[#3A342D]/10"></div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-[#3A342D]/30 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-[#3A342D]/10"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isGoogleLoading}
                  className="w-full py-2.5 sm:py-3.5 bg-white border-2 border-[#3A342D]/10 text-[#3A342D] rounded-xl font-semibold hover:border-[#3A342D]/30 hover:bg-gray-50 transition-all text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3"
                >
                  {isGoogleLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="hidden sm:inline">Instant Sign Up with Google</span>
                      <span className="sm:hidden">Sign Up with Google</span>
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  disabled={isLoading || isGoogleLoading}
                  className="text-[#3A342D]/60 hover:text-[#C9A961] font-medium text-[11px] sm:text-sm transition-colors"
                >
                  Already have an account? <span className="font-bold">Log in</span>
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="text-[#3A342D]/40 hover:text-[#3A342D] font-medium text-[11px] sm:text-sm transition-colors"
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
                  disabled={isLoading || isGoogleLoading}
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

                <div className="flex items-center gap-3 my-2">
                  <div className="flex-1 h-px bg-[#3A342D]/10"></div>
                  <span className="text-[10px] font-bold text-[#3A342D]/30 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-[#3A342D]/10"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isGoogleLoading}
                  className="w-full py-3 sm:py-3.5 bg-white border-2 border-[#3A342D]/10 text-[#3A342D] rounded-xl font-semibold hover:border-[#3A342D]/30 hover:bg-gray-50 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isGoogleLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Sign in with Google
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); }}
                  disabled={isLoading || isGoogleLoading}
                  className="text-[#3A342D]/60 hover:text-[#C9A961] font-medium text-xs sm:text-sm transition-colors"
                >
                  Forgot your password?
                </button>

                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); }}
                  disabled={isLoading || isGoogleLoading}
                  className="text-[#3A342D]/60 hover:text-[#C9A961] font-medium text-xs sm:text-sm transition-colors"
                >
                  Don't have an account? <span className="font-bold">Sign up</span>
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading || isGoogleLoading}
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

          <p className="text-[10px] sm:text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            By signing up, you agree to our{' '}
            {onShowTerms ? (
              <button 
                type="button" 
                onClick={onShowTerms} 
                className="underline hover:text-[#C9A961] transition-colors"
              >
                Terms & Conditions
              </button>
            ) : (
              <span className="underline">Terms & Conditions</span>
            )}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailAuth;

