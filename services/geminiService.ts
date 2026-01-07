// Client-side service that calls our secure server-side API
// API key is NEVER exposed to the browser
import { PropertyData } from "../types";

export interface PropertyInsightsResult {
  data: PropertyData;
  cached: boolean;
}

export class GeminiService {
  async fetchPropertyInsights(address: string, forceRefresh: boolean = false): Promise<PropertyInsightsResult> {
    console.log('[GeminiService] Fetching property insights for:', address, forceRefresh ? '(force refresh)' : '');
    
    try {
      // Call our secure server-side API (API key stays on server)
      const response = await fetch('/api/property-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, forceRefresh }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch property insights');
      }

      const { data, cached } = await response.json();
      
      console.log('[GeminiService] Successfully received property data', cached ? '(from cache)' : '(fresh)');
      return { data: data as PropertyData, cached: cached === true };
    } catch (error: any) {
      console.error("[GeminiService] Error:", error.message || error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
