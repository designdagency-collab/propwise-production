import { PropertyData } from "../types";

export class GeminiService {
  async fetchPropertyInsights(address: string): Promise<PropertyData> {
    try {
      const response = await fetch('/api/property-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch property insights');
      }

      return await response.json();
    } catch (error: any) {
      console.error("Strategy Compilation Error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
