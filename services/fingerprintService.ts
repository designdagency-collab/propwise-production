/**
 * Device Fingerprint Service
 * 
 * Uses FingerprintJS (open-source) to generate unique device identifiers
 * for preventing abuse of free searches without requiring sign-up.
 * 
 * Free searches per device: 1 (before requiring account creation)
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { supabase } from './supabaseService';

// How many free searches per device before requiring sign-up
const FREE_SEARCHES_PER_DEVICE = 1;

// LocalStorage key for caching fingerprint
const FINGERPRINT_CACHE_KEY = 'prop_device_fp';
const FINGERPRINT_SEARCHES_KEY = 'prop_device_searches';

let fpPromise: Promise<any> | null = null;

/**
 * Initialize FingerprintJS agent (cached)
 */
function getFingerprint(): Promise<any> {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  return fpPromise;
}

/**
 * Get or generate the device fingerprint
 * Uses cache for performance, regenerates if needed
 */
export async function getDeviceFingerprint(): Promise<string> {
  // Check cache first
  const cached = localStorage.getItem(FINGERPRINT_CACHE_KEY);
  if (cached) {
    return cached;
  }

  try {
    const fp = await getFingerprint();
    const result = await fp.get();
    const visitorId = result.visitorId;
    
    // Cache the fingerprint
    localStorage.setItem(FINGERPRINT_CACHE_KEY, visitorId);
    
    return visitorId;
  } catch (error) {
    console.error('[Fingerprint] Error generating fingerprint:', error);
    // Fallback: generate a random ID (less accurate but still works)
    const fallbackId = 'fb_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(FINGERPRINT_CACHE_KEY, fallbackId);
    return fallbackId;
  }
}

/**
 * Check if this device can perform a free search
 * Returns: { canSearch: boolean, searchesUsed: number, searchesRemaining: number }
 */
export async function checkDeviceSearchLimit(): Promise<{
  canSearch: boolean;
  searchesUsed: number;
  searchesRemaining: number;
}> {
  const fingerprint = await getDeviceFingerprint();
  
  // First check localStorage cache (faster)
  const cachedSearches = parseInt(localStorage.getItem(FINGERPRINT_SEARCHES_KEY) || '0', 10);
  
  // Try to get from Supabase for more accurate count
  try {
    const { data, error } = await supabase
      .from('device_fingerprints')
      .select('searches_used')
      .eq('fingerprint', fingerprint)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, which is fine for new devices
      console.warn('[Fingerprint] Supabase lookup error:', error);
    }

    const searchesUsed = data?.searches_used || cachedSearches;
    const searchesRemaining = Math.max(0, FREE_SEARCHES_PER_DEVICE - searchesUsed);
    
    // Update cache
    localStorage.setItem(FINGERPRINT_SEARCHES_KEY, searchesUsed.toString());
    
    return {
      canSearch: searchesUsed < FREE_SEARCHES_PER_DEVICE,
      searchesUsed,
      searchesRemaining,
    };
  } catch (error) {
    console.error('[Fingerprint] Error checking search limit:', error);
    // Fall back to localStorage
    return {
      canSearch: cachedSearches < FREE_SEARCHES_PER_DEVICE,
      searchesUsed: cachedSearches,
      searchesRemaining: Math.max(0, FREE_SEARCHES_PER_DEVICE - cachedSearches),
    };
  }
}

/**
 * Record a search for this device
 * Called after successful search to increment counter
 */
export async function recordDeviceSearch(): Promise<void> {
  const fingerprint = await getDeviceFingerprint();
  
  // Update localStorage immediately
  const currentSearches = parseInt(localStorage.getItem(FINGERPRINT_SEARCHES_KEY) || '0', 10);
  localStorage.setItem(FINGERPRINT_SEARCHES_KEY, (currentSearches + 1).toString());
  
  // Update Supabase in background
  try {
    // Try to upsert (insert or update)
    const { error } = await supabase
      .from('device_fingerprints')
      .upsert(
        { 
          fingerprint,
          searches_used: currentSearches + 1,
          last_seen: new Date().toISOString()
        },
        { 
          onConflict: 'fingerprint',
          ignoreDuplicates: false 
        }
      );

    if (error) {
      console.warn('[Fingerprint] Error recording search:', error);
    } else {
      console.log('[Fingerprint] Search recorded for device');
    }
  } catch (error) {
    console.error('[Fingerprint] Error recording search:', error);
  }
}

/**
 * Reset device fingerprint (for testing only)
 */
export function resetDeviceFingerprint(): void {
  localStorage.removeItem(FINGERPRINT_CACHE_KEY);
  localStorage.removeItem(FINGERPRINT_SEARCHES_KEY);
  fpPromise = null;
  console.log('[Fingerprint] Device fingerprint reset');
}

// Expose dev helper
if (typeof window !== 'undefined') {
  (window as any).__resetDeviceFingerprint = resetDeviceFingerprint;
  (window as any).__getDeviceFingerprint = getDeviceFingerprint;
  (window as any).__checkDeviceSearchLimit = checkDeviceSearchLimit;
}

export const fingerprintService = {
  getDeviceFingerprint,
  checkDeviceSearchLimit,
  recordDeviceSearch,
  resetDeviceFingerprint,
  FREE_SEARCHES_PER_DEVICE,
};

