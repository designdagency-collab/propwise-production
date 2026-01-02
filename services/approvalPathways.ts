/**
 * State-Aware Approval Pathway Mappings for Australian Properties
 * 
 * Each Australian state/territory has different terminology for planning approvals.
 * This utility provides the correct badge labels and tooltips based on location.
 */

export type AusState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'ACT' | 'NT';

export interface ApprovalBadgeConfig {
  label: string;
  tooltip: string;
}

// State-specific approval pathway mappings
const STATE_APPROVAL_MAPPINGS: Record<AusState, ApprovalBadgeConfig> = {
  NSW: {
    label: 'CDC / DA',
    tooltip: 'NSW: CDC is the fast-track checklist pathway for eligible works; otherwise DA. Always verify with council/certifier.'
  },
  VIC: {
    label: 'VicSmart / Planning Permit',
    tooltip: 'VIC: Eligible small works may be VicSmart; otherwise standard planning permit. Always verify with council.'
  },
  QLD: {
    label: 'Code / Impact Assessable',
    tooltip: 'QLD: Works are usually Code assessable or Impact assessable depending on site rules. Always verify.'
  },
  SA: {
    label: 'DTS / Performance',
    tooltip: 'SA: Deemed-to-Satisfy (DTS) is the checklist pathway; others are Performance/Impact assessed. Always verify.'
  },
  WA: {
    label: 'DTC Check (61A) / DA',
    tooltip: 'WA: Some house/extension works can be deemed-to-comply (Clause 61A) and may avoid DA; otherwise DA. Note: WA "CDC" often refers to BA3 (building), not planning. Always verify.'
  },
  TAS: {
    label: 'Planning Permit',
    tooltip: 'TAS: Permitted or Discretionary planning permit pathways vary by scheme. Always verify.'
  },
  ACT: {
    label: 'DA → BA',
    tooltip: 'ACT: Typically DA first, then Building Approval depending on works. Always verify.'
  },
  NT: {
    label: 'Development Permit',
    tooltip: 'NT: Development permit pathway varies by zone and proposal. Always verify.'
  }
};

// Fallback for unknown states
const UNKNOWN_STATE_CONFIG: ApprovalBadgeConfig = {
  label: 'Approval',
  tooltip: 'Approval pathway wording varies by state and proposal. Verify with local council/certifier.'
};

/**
 * Extract Australian state abbreviation from an address string
 * Handles both abbreviations (NSW, VIC) and full names (New South Wales, Victoria)
 */
export function extractStateFromAddress(address: string | null | undefined): AusState | null {
  if (!address) return null;
  
  // First try to match state abbreviations (case insensitive, word boundary)
  const abbrevRegex = /\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/i;
  const abbrevMatch = address.match(abbrevRegex);
  
  if (abbrevMatch) {
    return abbrevMatch[1].toUpperCase() as AusState;
  }
  
  // If no abbreviation found, try full state names (Google Places often uses these)
  const fullNameMappings: Record<string, AusState> = {
    'new south wales': 'NSW',
    'victoria': 'VIC',
    'queensland': 'QLD',
    'south australia': 'SA',
    'western australia': 'WA',
    'tasmania': 'TAS',
    'australian capital territory': 'ACT',
    'northern territory': 'NT',
  };
  
  const lowerAddress = address.toLowerCase();
  for (const [fullName, abbrev] of Object.entries(fullNameMappings)) {
    if (lowerAddress.includes(fullName)) {
      return abbrev;
    }
  }
  
  return null;
}

/**
 * Get the approval badge configuration for a given state
 * Returns state-specific labels and tooltips for planning pathway badges
 */
export function getApprovalBadgeForState(state: string | null | undefined): ApprovalBadgeConfig {
  if (!state) return UNKNOWN_STATE_CONFIG;
  
  const normalizedState = state.toUpperCase() as AusState;
  return STATE_APPROVAL_MAPPINGS[normalizedState] || UNKNOWN_STATE_CONFIG;
}

/**
 * Get a state-aware pathway label based on the generic pathway type
 * 
 * @param pathway - The generic pathway type ('Exempt', 'CDC', 'DA', 'Unknown')
 * @param state - The Australian state abbreviation
 * @param isStrata - Whether the property is strata/unit (requires special handling)
 * @returns The display label with state-appropriate terminology
 */
export function getStateAwarePathwayLabel(
  pathway: string,
  state: AusState | null,
  isStrata: boolean = false
): string {
  // Strata always needs Strata Approval regardless of state
  if (isStrata && pathway === 'Exempt') {
    return 'Strata Approval';
  }
  
  // Minor works / Exempt stays the same across all states
  if (pathway === 'Exempt') {
    return 'Minor Works';
  }
  
  // DA stays as DA across all states (it's universally understood)
  if (pathway === 'DA') {
    return 'DA (indicative)';
  }
  
  // Unknown pathway
  if (pathway === 'Unknown' || !pathway) {
    return 'Requires Review';
  }
  
  // CDC pathway - this is where we apply state-specific terminology
  if (pathway === 'CDC') {
    const config = getApprovalBadgeForState(state);
    return `${config.label} (indicative)`;
  }
  
  return 'Requires Review';
}

/**
 * Get state-aware tooltip for a pathway badge
 */
export function getStateAwarePathwayTooltip(
  pathway: string,
  state: AusState | null,
  isStrata: boolean = false
): string {
  if (isStrata && pathway === 'Exempt') {
    return "Strata properties require Owner's Corporation approval. Council approval may also be needed depending on scope.";
  }
  
  if (pathway === 'Exempt') {
    return "Minor works that typically don't require formal council approval. Verify with your local council.";
  }
  
  if (pathway === 'DA') {
    return "Development Application: Council assessment required. Timeframes and outcomes vary by project and council.";
  }
  
  if (pathway === 'Unknown' || !pathway) {
    return "Approval requirements vary. Consult a town planner or your local council for site-specific advice.";
  }
  
  // CDC pathway - return state-specific tooltip
  if (pathway === 'CDC') {
    const config = getApprovalBadgeForState(state);
    return config.tooltip;
  }
  
  return "Approval requirements vary. Consult a town planner or your local council for site-specific advice.";
}

// ============================================================================
// STATE-SPECIFIC TERMINOLOGY REPLACEMENTS FOR EXPLANATION TEXT
// ============================================================================

/**
 * State-specific terminology replacements
 * Maps NSW-centric terms to state-appropriate equivalents
 */
const STATE_TERMINOLOGY_REPLACEMENTS: Record<AusState, { find: RegExp; replace: string }[]> = {
  NSW: [], // NSW uses CDC/DA natively, no replacements needed
  VIC: [
    { find: /\bCDC\b/g, replace: 'VicSmart' },
    { find: /\bComplying Development Certificate\b/gi, replace: 'VicSmart application' },
    { find: /\bComplying Development\b/gi, replace: 'VicSmart' },
  ],
  QLD: [
    { find: /\bCDC\b/g, replace: 'Code Assessment' },
    { find: /\bComplying Development Certificate\b/gi, replace: 'Code Assessable development' },
    { find: /\bComplying Development\b/gi, replace: 'Code Assessable development' },
    { find: /\bDA\b(?!\s*\()/g, replace: 'Impact Assessment' }, // Don't replace "DA (" patterns
  ],
  SA: [
    { find: /\bCDC\b/g, replace: 'DTS (Deemed-to-Satisfy)' },
    { find: /\bComplying Development Certificate\b/gi, replace: 'Deemed-to-Satisfy (DTS) pathway' },
    { find: /\bComplying Development\b/gi, replace: 'Deemed-to-Satisfy (DTS)' },
  ],
  WA: [
    { find: /\bCDC\b/g, replace: 'Deemed-to-Comply (Clause 61A)' },
    { find: /\bComplying Development Certificate\b/gi, replace: 'Deemed-to-Comply pathway (Clause 61A)' },
    { find: /\bComplying Development\b/gi, replace: 'Deemed-to-Comply' },
  ],
  TAS: [
    { find: /\bCDC\b/g, replace: 'Permitted pathway' },
    { find: /\bComplying Development Certificate\b/gi, replace: 'Permitted development pathway' },
    { find: /\bComplying Development\b/gi, replace: 'Permitted development' },
  ],
  ACT: [
    { find: /\bCDC\b/g, replace: 'Exempt/DA pathway' },
    { find: /\bComplying Development Certificate\b/gi, replace: 'Development Application' },
    { find: /\bComplying Development\b/gi, replace: 'exempt or DA pathway' },
  ],
  NT: [
    { find: /\bCDC\b/g, replace: 'Permitted development' },
    { find: /\bComplying Development Certificate\b/gi, replace: 'Development Permit' },
    { find: /\bComplying Development\b/gi, replace: 'Permitted development' },
  ],
};

/**
 * Replace NSW-centric planning terminology with state-appropriate terms
 * 
 * @param text - The explanation text to process
 * @param state - The Australian state/territory
 * @returns Text with state-appropriate terminology
 */
export function replaceStateTerminology(text: string | null | undefined, state: AusState | null): string {
  if (!text) return '';
  if (!state) return text;
  
  const replacements = STATE_TERMINOLOGY_REPLACEMENTS[state];
  if (!replacements || replacements.length === 0) return text;
  
  let result = text;
  for (const { find, replace } of replacements) {
    result = result.replace(find, replace);
  }
  
  return result;
}

