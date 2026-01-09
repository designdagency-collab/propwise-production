import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Vite environment variables
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey;

export class SupabaseService {
  public supabase: SupabaseClient | null = null;
  
  constructor() {
    if (isSupabaseConfigured) {
      this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'implicit'  // Required to pass tokens via URL hash
        }
      });
    } else {
      console.warn('Supabase not configured - phone verification will be unavailable');
    }
  }
  // Check if Supabase is available
  isConfigured(): boolean {
    return this.supabase !== null;
  }

  // Send OTP to phone number
  async sendOTP(phone: string): Promise<{ error?: any }> {
    if (!this.supabase) {
      return { error: { message: 'Supabase not configured' } };
    }
    const { error } = await this.supabase.auth.signInWithOtp({
      phone: phone,
      options: { channel: 'sms' }
    });
    return { error };
  }

  // Verify OTP code
  async verifyOTP(phone: string, token: string): Promise<{ 
    user: any; 
    session: any; 
    error?: any 
  }> {
    if (!this.supabase) {
      return { user: null, session: null, error: { message: 'Supabase not configured' } };
    }
    const { data, error } = await this.supabase.auth.verifyOtp({
      phone: phone,
      token: token,
      type: 'sms'
    });
    return { user: data?.user, session: data?.session, error };
  }

  // Get the current access token for authenticated API calls
  async getAccessToken(): Promise<string | null> {
    if (!this.supabase) return null;
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      return session?.access_token || null;
    } catch {
      return null;
    }
  }

  // Make authenticated API call with JWT token
  // Can optionally pass token directly (useful during OAuth when session isn't synced yet)
  async authenticatedFetch(url: string, options: RequestInit = {}, providedToken?: string): Promise<Response> {
    const token = providedToken || await this.getAccessToken();
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      console.warn('[Supabase] authenticatedFetch - no token available for:', url);
    }
    return fetch(url, { ...options, headers, credentials: 'include' });
  }

  // Get current user profile using server-side API to bypass RLS issues during OAuth
  // Can optionally pass accessToken directly (for OAuth where session isn't synced yet)
  async getCurrentProfile(userId?: string, accessToken?: string): Promise<any | null> {
    if (!userId) {
      console.log('[Supabase] getCurrentProfile - no userId provided');
      return null;
    }
    
    console.log('[Supabase] getCurrentProfile - fetching via API for userId:', userId, 'hasToken:', !!accessToken);
    
    try {
      // Use server-side API with JWT authentication
      const response = await this.authenticatedFetch('/api/get-profile', {
        method: 'POST',
        body: JSON.stringify({ userId })
      }, accessToken);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('[Supabase] getCurrentProfile - API error:', errorData.error);
        return null;
      }
      
      const { profile } = await response.json();
      
      console.log('[Supabase] getCurrentProfile - SUCCESS:', profile ? { 
        id: profile.id, 
        credit_topups: profile.credit_topups, 
        search_count: profile.search_count,
        email: profile.email
      } : 'no profile');
      
      return profile;
    } catch (err: any) {
      console.error('[Supabase] getCurrentProfile - exception:', err?.message);
      return null;
    }
  }

  // Update credit topups in profile
  async updateCreditTopups(userId: string, credits: number): Promise<void> {
    if (!this.supabase) return;
    try {
      const { error } = await this.supabase
        .from('profiles')
        .update({ credit_topups: credits, updated_at: new Date().toISOString() })
        .eq('id', userId);
      
      if (error) throw error;
      console.log('[Supabase] Credit topups updated:', credits);
    } catch (error) {
      console.error('[Supabase] Failed to update credit topups:', error);
    }
  }

  // Update plan type in profile
  async updatePlanType(userId: string, planType: string): Promise<void> {
    if (!this.supabase) return;
    try {
      const { error } = await this.supabase
        .from('profiles')
        .update({ plan_type: planType, updated_at: new Date().toISOString() })
        .eq('id', userId);
      
      if (error) throw error;
      console.log('[Supabase] Plan type updated:', planType);
    } catch (error) {
      console.error('[Supabase] Failed to update plan type:', error);
    }
  }

  // Update phone number in profile
  async updatePhone(userId: string, phone: string): Promise<void> {
    if (!this.supabase) return;
    try {
      const { error } = await this.supabase
        .from('profiles')
        .update({ phone, updated_at: new Date().toISOString() })
        .eq('id', userId);
      
      if (error) throw error;
      console.log('[Supabase] Phone updated');
    } catch (error) {
      console.error('[Supabase] Failed to update phone:', error);
    }
  }

  // Add credits to existing topups
  async addCreditTopups(userId: string, additionalCredits: number): Promise<void> {
    if (!this.supabase) return;
    try {
      // Get current credits first
      const profile = await this.getCurrentProfile();
      const currentCredits = profile?.credit_topups || 0;
      const newTotal = currentCredits + additionalCredits;
      
      await this.updateCreditTopups(userId, newTotal);
      console.log('[Supabase] Added credits:', additionalCredits, '-> Total:', newTotal);
    } catch (error) {
      console.error('[Supabase] Failed to add credit topups:', error);
    }
  }

  // Update PRO subscription usage (monthly quota tracking)
  async updateProUsage(userId: string, proMonth: string, proUsed: number): Promise<void> {
    if (!this.supabase) return;
    try {
      const { error } = await this.supabase
        .from('profiles')
        .update({ 
          pro_month: proMonth, 
          pro_used: proUsed, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', userId);
      
      if (error) throw error;
      console.log('[Supabase] PRO usage updated:', { proMonth, proUsed });
    } catch (error) {
      console.error('[Supabase] Failed to update PRO usage:', error);
    }
  }

  // Increment PRO usage count
  async incrementProUsage(userId: string): Promise<void> {
    if (!this.supabase) return;
    try {
      const profile = await this.getCurrentProfile();
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      let proMonth = profile?.pro_month || currentMonth;
      let proUsed = profile?.pro_used || 0;
      
      // Reset if new month
      if (proMonth !== currentMonth) {
        proMonth = currentMonth;
        proUsed = 0;
      }
      
      proUsed += 1;
      await this.updateProUsage(userId, proMonth, proUsed);
    } catch (error) {
      console.error('[Supabase] Failed to increment PRO usage:', error);
    }
  }

  // Update user profile (phone, name, etc.)
  async updateProfile(userId: string, updates: { phone?: string; full_name?: string }): Promise<void> {
    if (!this.supabase) return;
    try {
      await this.supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
    } catch (error) {
      console.log('Failed to update profile:', error);
    }
  }

  // Get user search count from Supabase (optional enhancement)
  async getUserSearchCount(userId: string): Promise<number | null> {
    if (!this.supabase) return null;
    try {
      const { data } = await this.supabase
        .from('profiles')
        .select('search_count')
        .eq('id', userId)
        .single();

      return data?.search_count || null;
    } catch {
      return null; // Fail silently
    }
  }

  // Increment search count in Supabase and save to search history
  async incrementSearchCountInDB(userId: string, address: string): Promise<void> {
    console.log('[Supabase] incrementSearchCountInDB called:', { userId, address });
    
    if (!this.supabase) {
      console.error('[Supabase] Client not initialized!');
      return;
    }
    try {
      console.log('[Supabase] Starting save process...');
      
      // First, ensure the profile exists (upsert if needed)
      const user = await this.getCurrentUser();
      if (user) {
        const { error: profileError } = await this.supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: user.email,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        
        if (profileError) {
          console.error('Failed to upsert profile:', profileError);
        }
      }
      
      // Update search count
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('search_count')
        .eq('id', userId)
        .single();
      
      const currentCount = profile?.search_count || 0;

      await this.supabase
        .from('profiles')
        .update({ search_count: currentCount + 1 })
        .eq('id', userId);

      // Insert search history
      const { error } = await this.supabase
        .from('search_history')
        .insert({ user_id: userId, address });
      
      if (error) {
        console.error('Failed to insert search history:', error);
        // Log more details for debugging
        console.error('Error details:', { code: error.code, message: error.message, details: error.details });
      } else {
        console.log('Search history saved successfully for:', address);
      }
    } catch (error) {
      console.error('Supabase update failed:', error);
    }
  }

  // Get user's search history (most recent first, limit 20)
  async getSearchHistory(userId: string): Promise<{ address: string; created_at: string }[]> {
    if (!this.supabase) return [];
    try {
      const { data, error } = await this.supabase
        .from('search_history')
        .select('address, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching search history:', error);
      return [];
    }
  }

  // Get user's active subscription
  async getActiveSubscription(userId: string): Promise<{ plan_type: string; status: string } | null> {
    if (!this.supabase) return null;
    try {
      const { data } = await this.supabase
        .from('subscriptions')
        .select('plan_type, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      return data;
    } catch {
      return null;
    }
  }

  // Get current authenticated user
  async getCurrentUser(): Promise<any | null> {
    if (!this.supabase) return null;
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      return user;
    } catch {
      return null;
    }
  }

  // Update subscription (for Stripe webhook)
  async updateSubscription(
    userId: string,
    planType: string, // Accepts any plan type string
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
  ): Promise<void> {
    if (!this.supabase) return;
    try {
      await this.supabase
        .from('subscriptions')
        .update({ status: 'inactive' })
        .eq('user_id', userId)
        .eq('status', 'active');

      await this.supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_type: planType,
          status: 'active',
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId
        });
    } catch (error) {
      console.error('Subscription update error:', error);
    }
  }

  // ============ EMAIL AUTH METHODS ============

  // Sign up with email and password
  async signUpWithEmail(email: string, password: string, fullName?: string): Promise<{
    user: any;
    session: any;
    error?: any;
  }> {
    if (!this.supabase) {
      return { user: null, session: null, error: { message: 'Supabase not configured' } };
    }
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || ''
        },
        // Skip email confirmation redirect - we handle this in Supabase settings
        emailRedirectTo: 'https://upblock.ai'
      }
    });
    
    return { user: data?.user, session: data?.session, error };
  }

  // Sign in with email and password
  async signInWithEmail(email: string, password: string): Promise<{
    user: any;
    session: any;
    error?: any;
  }> {
    if (!this.supabase) {
      return { user: null, session: null, error: { message: 'Supabase not configured' } };
    }
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    return { user: data?.user, session: data?.session, error };
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<{ error?: any }> {
    if (!this.supabase) {
      return { error: { message: 'Supabase not configured' } };
    }
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://upblock.ai'
      }
    });
    return { error };
  }

  // Send password reset email
  async sendPasswordResetEmail(email: string): Promise<{ error?: any }> {
    if (!this.supabase) {
      return { error: { message: 'Supabase not configured' } };
    }
    // Use production URL explicitly to avoid localhost issues
    const redirectUrl = window.location.hostname === 'localhost' 
      ? 'https://upblock.ai?reset=true'
      : `${window.location.origin}?reset=true`;
    
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    return { error };
  }

  // Update password (after reset)
  async updatePassword(newPassword: string): Promise<{ error?: any }> {
    if (!this.supabase) {
      return { error: { message: 'Supabase not configured' } };
    }
    const { error } = await this.supabase.auth.updateUser({
      password: newPassword
    });
    return { error };
  }

  // Sign out
  async signOut(): Promise<void> {
    if (!this.supabase) return;
    // Use global scope to clear all sessions across tabs
    await this.supabase.auth.signOut({ scope: 'global' });
  }
}

export const supabaseService = new SupabaseService();

// Export supabase instance for direct access if needed
export const supabase = supabaseService.supabase;

