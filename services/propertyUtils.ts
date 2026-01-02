/**
 * Property Display Utilities
 * 
 * Handles consistent formatting of land size and filtering of comparable sales.
 */

import { ComparableSale } from '../types';

// ============================================================================
// LAND SIZE FORMATTING
// ============================================================================

/**
 * Format area in square meters with proper symbol
 * @param value - The area value (number or string like "149sqm", "149 m²", "149")
 * @returns Formatted string like "149 m²" or null if invalid
 */
export function formatAreaM2(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  
  // If it's a number, format directly
  if (typeof value === 'number') {
    return `${Math.round(value)} m²`;
  }
  
  // If it's a string, extract the numeric part
  const numericMatch = value.match(/[\d,]+\.?\d*/);
  if (!numericMatch) return null;
  
  const numericValue = parseFloat(numericMatch[0].replace(/,/g, ''));
  if (isNaN(numericValue) || numericValue <= 0) return null;
  
  return `${Math.round(numericValue)} m²`;
}

/**
 * Get the primary area label and formatted value for property display
 * In Australia, "land size" is typically the block/lot size, not floor area
 * 
 * @param landSize - The land size string from property data
 * @param propertyType - The type of property (House, Apartment, etc.)
 * @returns Object with label and formatted value
 */
export function getPrimaryAreaDisplay(
  landSize: string | null | undefined,
  propertyType: string | null | undefined
): { label: string; value: string } {
  const formattedArea = formatAreaM2(landSize);
  
  // For apartments/units, floor area is more relevant but we still label correctly
  const isUnit = (propertyType || '').toLowerCase().match(/apartment|unit|flat/);
  
  if (!formattedArea) {
    return {
      label: isUnit ? 'Floor area' : 'Land',
      value: 'TBC'
    };
  }
  
  // For apartments with very small "land" values, it's likely floor area
  const numericValue = parseFloat(landSize?.replace(/[^\d.]/g, '') || '0');
  if (isUnit && numericValue < 200) {
    return {
      label: 'Floor area',
      value: formattedArea
    };
  }
  
  // Default to Land for houses and larger properties
  return {
    label: 'Land',
    value: formattedArea
  };
}

// ============================================================================
// COMPARABLE SALES FILTERING
// ============================================================================

// Statuses that indicate a property is NOT sold (exclude these)
const UNSOLD_STATUS_PATTERNS = [
  'for sale', 'listed', 'active', 'under offer', 'contact agent',
  'price guide', 'auction', 'private sale', 'withdrawn', 'coming soon',
  'expressions of interest', 'eoi', 'under contract', 'pending'
];

// Maximum age for comparable sales (18 months in milliseconds)
const MAX_COMP_AGE_MS = 18 * 30 * 24 * 60 * 60 * 1000; // ~18 months

/**
 * Check if a comparable sale is valid (actually sold, not just listed)
 */
export function isValidSoldComparable(sale: ComparableSale): boolean {
  // Must have a price > 0
  if (!sale.price || sale.price <= 0) return false;
  
  // Must have a valid date
  if (!sale.date || sale.date.trim() === '') return false;
  
  // Check if date is parseable and within recency window
  const saleDate = new Date(sale.date);
  if (isNaN(saleDate.getTime())) {
    // If date is not parseable (e.g., "Mar 2024"), try to extract year/month
    const dateMatch = sale.date.match(/(\w+)\s+(\d{4})/);
    if (!dateMatch) return false;
  }
  
  // Check status field if present (from enhanced type)
  const status = (sale as any).status?.toLowerCase() || '';
  if (status) {
    // Explicitly exclude unsold statuses
    for (const pattern of UNSOLD_STATUS_PATTERNS) {
      if (status.includes(pattern)) return false;
    }
  }
  
  // Check notes for listing indicators
  const notes = (sale.notes || '').toLowerCase();
  for (const pattern of UNSOLD_STATUS_PATTERNS) {
    if (notes.includes(pattern)) return false;
  }
  
  return true;
}

/**
 * Check if a sale date is within the recency window
 */
export function isWithinRecencyWindow(dateStr: string, maxAgeMs: number = MAX_COMP_AGE_MS): boolean {
  const saleDate = parseSaleDate(dateStr);
  if (!saleDate) return false;
  
  const now = new Date();
  const ageMs = now.getTime() - saleDate.getTime();
  
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

/**
 * Parse a sale date string into a Date object
 * Handles formats like "Mar 2024", "2024-03-15", "15/03/2024"
 */
function parseSaleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try standard date parsing first
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;
  
  // Try "Mon YYYY" format (e.g., "Mar 2024")
  const monthYearMatch = dateStr.match(/(\w{3})\s+(\d{4})/);
  if (monthYearMatch) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIndex = monthNames.indexOf(monthYearMatch[1].toLowerCase());
    if (monthIndex >= 0) {
      return new Date(parseInt(monthYearMatch[2]), monthIndex, 15); // Use middle of month
    }
  }
  
  // Try DD/MM/YYYY format
  const ddmmyyyyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyyMatch) {
    return new Date(parseInt(ddmmyyyyMatch[3]), parseInt(ddmmyyyyMatch[2]) - 1, parseInt(ddmmyyyyMatch[1]));
  }
  
  return null;
}

/**
 * Filter and sort comparable sales to only include valid sold properties
 * 
 * @param sales - Raw comparable sales from AI/API
 * @param maxResults - Maximum number of results to return (default 6)
 * @returns Filtered and sorted array of valid sold comparables
 */
export function filterSoldComparables(
  sales: ComparableSale[] | undefined | null,
  maxResults: number = 6
): ComparableSale[] {
  if (!sales || !Array.isArray(sales)) return [];
  
  // Filter to only valid sold comparables within recency window
  const validSales = sales.filter(sale => 
    isValidSoldComparable(sale) && isWithinRecencyWindow(sale.date)
  );
  
  // Sort by date (most recent first)
  validSales.sort((a, b) => {
    const dateA = parseSaleDate(a.date);
    const dateB = parseSaleDate(b.date);
    if (!dateA || !dateB) return 0;
    return dateB.getTime() - dateA.getTime();
  });
  
  // Return top N results
  return validSales.slice(0, maxResults);
}

/**
 * Get fallback message when not enough sold comparables are available
 */
export function getComparablesFallbackMessage(filteredCount: number): string | null {
  if (filteredCount >= 2) return null;
  
  return 'Not enough recent sold comparables found. Sales data may be limited for this area or property type.';
}

