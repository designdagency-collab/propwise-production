/**
 * PdfReport.tsx - Premium A4 PDF Template
 * 
 * This is a DEDICATED PDF-ONLY component. It does NOT clone the live UI DOM.
 * Instead, it renders a clean, print-first layout using the same PropertyData.
 * 
 * Key principles:
 * - Explicit A4 pages (210mm x 297mm)
 * - No truncation anywhere
 * - Single-source-of-truth badges (no duplicates)
 * - Inline SVG icons (no FontAwesome CDN)
 * - Clean tables for comparables
 * - Header/footer on every page
 */

import React from 'react';
import { PropertyData } from '../../types';
import { 
  extractStateFromAddress, 
  getStateAwarePathwayLabel,
  replaceStateTerminology,
  AusState 
} from '../../services/approvalPathways';
import {
  getPrimaryAreaDisplay,
  filterSoldComparables,
  getComparablesFallbackMessage
} from '../../services/propertyUtils';

// ============================================================================
// INLINE SVG ICONS (no CDN dependency)
// ============================================================================
const Icons = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  mapPin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  trendingUp: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  hammer: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15L22 10.64"/><path d="M20.91 11.7l-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/></svg>,
  dollarSign: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  alertTriangle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  building: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>,
  tag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  train: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="M8 19l-2 3"/><path d="M18 22l-2-3"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>,
  shoppingCart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  graduationCap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>,
  tree: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-7"/><path d="M9 7 6 12h5l-3 5h8l-3-5h5L12 2 9 7z"/></svg>,
  checkCircle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
};

// ============================================================================
// TYPES
// ============================================================================
interface VisualizationData {
  beforeImage: string;
  afterImage: string;
  title: string;
  type: 'renovation' | 'development';
}

interface PdfReportProps {
  data: PropertyData;
  address: string;
  mapImageUrl?: string;
  generatedVisuals?: {
    [key: string]: VisualizationData[];
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '—';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

const formatRange = (low: number | undefined, high: number | undefined): string => {
  if (!low && !high) return '—';
  return `${formatCurrency(low)} – ${formatCurrency(high)}`;
};

// Helper to check if a value is negative
const isNegative = (value: number | undefined): boolean => {
  return value !== undefined && value !== null && value < 0;
};

// Render a range with conditional coloring (red for negative, green for positive)
const ColoredRange: React.FC<{ low?: number; high?: number }> = ({ low, high }) => {
  if (!low && !high) return <span>—</span>;
  const lowColor = isNegative(low) ? '#DC2626' : '#065F46'; // red-600 : emerald-800
  const highColor = isNegative(high) ? '#DC2626' : '#065F46';
  return (
    <span>
      <span style={{ color: lowColor }}>{formatCurrency(low)}</span>
      <span style={{ color: '#6B7280' }}> – </span>
      <span style={{ color: highColor }}>{formatCurrency(high)}</span>
    </span>
  );
};

// ============================================================================
// APPROVAL BADGE - SINGLE SOURCE OF TRUTH (STATE-AWARE)
// ============================================================================
type ApprovalType = 'EXEMPT' | 'CDC' | 'DA' | 'STRATA' | 'UNKNOWN';

interface ApprovalBadgeProps {
  type: string;
  className?: string;
  propertyState?: AusState | null;
  isStrata?: boolean;
}

const ApprovalBadge: React.FC<ApprovalBadgeProps> = ({ 
  type, 
  className = '', 
  propertyState = null,
  isStrata = false 
}) => {
  const normalizedType = type?.toUpperCase() || 'UNKNOWN';
  
  // Use state-aware labels for CDC pathway
  const getLabel = (): string => {
    // For CDC, use state-aware label
    if (normalizedType === 'CDC') {
      return getStateAwarePathwayLabel('CDC', propertyState, isStrata);
    }
    // For other pathways, use standard labels
    return getStateAwarePathwayLabel(type, propertyState, isStrata);
  };
  
  const getBackgroundColor = (): string => {
    switch (normalizedType) {
      case 'EXEMPT':
        return '#64748b';
      case 'CDC':
        return '#3b82f6';
      case 'DA':
        return '#f59e0b';
      case 'STRATA':
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  };
  
  return (
    <span
      className={`pdf-badge ${className}`}
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: '4px',
        fontSize: '8px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        backgroundColor: getBackgroundColor(),
        color: '#fff',
        whiteSpace: 'nowrap',
      }}
    >
      {getLabel()}
    </span>
  );
};

// ============================================================================
// PDF PAGE WRAPPER
// ============================================================================
const PdfPage: React.FC<{ children: React.ReactNode; pageNum: number; totalPages: number }> = ({ 
  children, 
  pageNum, 
  totalPages 
}) => (
  <div className="pdf-page">
    {/* Page Header */}
    <div className="pdf-page-header">
      <div className="pdf-header-brand">
        <span className="pdf-header-logo">upblock.ai</span>
        <span className="pdf-header-divider">|</span>
        <span className="pdf-header-title">Property Strategy Guide</span>
      </div>
    </div>
    
    {/* Page Content */}
    <div className="pdf-page-content">
      {children}
    </div>
    
    {/* Page Footer */}
    <div className="pdf-page-footer">
      <span className="pdf-footer-disclaimer">
        AI-assisted insights using public data. Not financial advice or valuation. Consult qualified professionals.
      </span>
      <span className="pdf-footer-page">Page {pageNum} of {totalPages}</span>
    </div>
  </div>
);

// ============================================================================
// MAIN PDF REPORT COMPONENT
// ============================================================================
const PdfReport: React.FC<PdfReportProps> = ({ data, address, mapImageUrl, generatedVisuals = {} }) => {
  // Extract Australian state from address for state-aware approval badges
  const propertyState = extractStateFromAddress(address);
  
  // Check if property is strata (affects approval pathway labels)
  const isStrata = data.propertyType?.toLowerCase().includes('unit') || 
                   data.propertyType?.toLowerCase().includes('apartment') ||
                   data.propertyType?.toLowerCase().includes('strata');

  // Calculate total pages based on content
  const hasStrategies = data.valueAddStrategies && data.valueAddStrategies.length > 0;
  const hasScenarios = data.developmentScenarios && data.developmentScenarios.length > 0;
  
  // Filter comparable sales to only include verified sold properties
  const filteredComparables = filterSoldComparables(data.comparableSales?.nearbySales);
  const comparablesFallback = getComparablesFallbackMessage(filteredComparables.length);
  const hasComparables = filteredComparables.length > 0;
  
  const hasWatchOuts = data.watchOuts && data.watchOuts.length > 0;
  
  // Helper to validate base64 image data
  const isValidBase64Image = (str: string | undefined | null): boolean => {
    if (!str || typeof str !== 'string') return false;
    if (!str.startsWith('data:image/')) return false;
    // Must have actual image data after the comma
    const commaIndex = str.indexOf(',');
    if (commaIndex === -1) return false;
    const imageData = str.slice(commaIndex + 1);
    // Must have substantial data (at least 100 chars to be a real image)
    return imageData.length > 100;
  };

  // Collect all visualizations with their strategy references
  const allVisualizations: Array<{
    visual: VisualizationData;
    strategyName: string;
    strategyType: 'strategy' | 'development';
  }> = [];
  
  // Safely iterate over generatedVisuals with null checks
  if (generatedVisuals && typeof generatedVisuals === 'object') {
    Object.entries(generatedVisuals).forEach(([key, visuals]) => {
      if (!key || !visuals || !Array.isArray(visuals)) return;
      
      const parts = key.split('-');
      if (parts.length < 2) return;
      
      const [type, indexStr] = parts;
      const index = parseInt(indexStr, 10);
      if (isNaN(index)) return;
      
      visuals.forEach(visual => {
        // Validate afterImage is present AND contains valid base64 image data
        if (!visual || !isValidBase64Image(visual.afterImage)) return;
        
        let strategyName = visual.title || 'Visualization';
        
        // Try to get the actual strategy name from the data
        if (type === 'strategy' && data.valueAddStrategies?.[index]) {
          strategyName = data.valueAddStrategies[index].title || visual.title || 'Value-Add Strategy';
        } else if (type === 'development' && data.developmentScenarios?.[index]) {
          strategyName = data.developmentScenarios[index].title || visual.title || 'Development Scenario';
        }
        
        allVisualizations.push({
          visual,
          strategyName,
          strategyType: type as 'strategy' | 'development'
        });
      });
    });
  }
  
  const hasVisualizations = allVisualizations.length > 0;
  
  // Calculate pages needed for visualizations
  // 2 visualizations per page (280px height each)
  const visualizationPages = hasVisualizations 
    ? Math.ceil(allVisualizations.length / 2)
    : 0;
  
  const totalPages = 4 + visualizationPages; // Base 4 pages + visualization pages

  // Calculate post-improvement range
  const baseline = data.valueSnapshot?.indicativeMidpoint || 0;
  const strategies = data.valueAddStrategies || [];
  const totalUpliftLow = strategies.reduce((sum, s) => sum + (s.estimatedUplift?.low || 0), 0);
  const totalUpliftHigh = strategies.reduce((sum, s) => sum + (s.estimatedUplift?.high || 0), 0);
  const postImprovementRange = strategies.length > 0 
    ? formatRange(baseline + totalUpliftLow, baseline + totalUpliftHigh)
    : '—';

  return (
    <div className="pdf-document">
      {/* ================================================================
          PAGE 1: COVER - Property Header + Map + Local Snapshot
          ================================================================ */}
      <PdfPage pageNum={1} totalPages={totalPages}>
        {/* Property Header */}
        <div className="pdf-property-header">
          <div className="pdf-property-badge">PROPERTY STRATEGY REPORT</div>
          <h1 className="pdf-property-address">{address}</h1>
          <div className="pdf-property-meta-row">
            <p className="pdf-property-meta">
              {data.propertyType || 'Residential'} • {getPrimaryAreaDisplay(data.landSize, data.propertyType).label} • {getPrimaryAreaDisplay(data.landSize, data.propertyType).value}
            </p>
            {data.isCombinedLots && (
              <span className="pdf-combined-lots-badge">
                📦 Combined Lots Analysis
              </span>
            )}
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="pdf-metrics-row">
          <div className="pdf-metric">
            <span className="pdf-metric-label">ESTIMATED VALUE</span>
            <span className="pdf-metric-value">{formatCurrency(data.valueSnapshot?.indicativeMidpoint)}</span>
          </div>
          <div className="pdf-metric">
            <span className="pdf-metric-label">POST-IMPROVEMENT</span>
            <span className="pdf-metric-value pdf-metric-highlight">
              {postImprovementRange}
            </span>
          </div>
          <div className="pdf-metric">
            <span className="pdf-metric-label">GROWTH TREND (5YR)</span>
            <span className="pdf-metric-value">{data.valueSnapshot?.growth || '—'}</span>
          </div>
          <div className="pdf-metric">
            <span className="pdf-metric-label">DATA CONFIDENCE</span>
            <span className="pdf-metric-value">{data.valueSnapshot?.confidenceLevel || '—'}</span>
          </div>
        </div>

        {/* Map */}
        <div className="pdf-map-container">
          {mapImageUrl ? (
            <img 
              src={mapImageUrl} 
              alt={`Map of ${address}`} 
              className="pdf-map-image"
              style={{ display: 'block', width: '100%', height: '250px', objectFit: 'cover', borderRadius: '12px' }}
            />
          ) : (
            <div className="pdf-map-placeholder">
              <span className="pdf-icon" style={{ width: 24, height: 24 }}>{Icons.mapPin}</span>
              <span>{address}</span>
            </div>
          )}
        </div>

        {/* Local Snapshot - Amenities */}
        {data.proximity && data.proximity.length > 0 && (
          <div className="pdf-section pdf-section-after-map">
            <h2 className="pdf-section-title">
              <span className="pdf-icon">{Icons.mapPin}</span>
              Local Snapshot
            </h2>
            <div className="pdf-amenities-grid">
              {data.proximity.slice(0, 4).map((amenity, i) => (
                <div key={i} className="pdf-amenity-card">
                  <span className="pdf-amenity-icon">
                    {amenity.type === 'transport' && Icons.train}
                    {amenity.type === 'shopping' && Icons.shoppingCart}
                    {amenity.type === 'education' && Icons.graduationCap}
                    {amenity.type === 'leisure' && Icons.tree}
                    {!['transport', 'shopping', 'education', 'leisure'].includes(amenity.type) && Icons.mapPin}
                  </span>
                  <div className="pdf-amenity-info">
                    <span className="pdf-amenity-name">{amenity.name}</span>
                    <span className="pdf-amenity-distance">{amenity.distance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </PdfPage>

      {/* ================================================================
          PAGE 2: VALUE-ADD STRATEGIES
          ================================================================ */}
      <PdfPage pageNum={2} totalPages={totalPages}>
        <div className="pdf-section">
          <h2 className="pdf-section-title">
            <span className="pdf-icon">{Icons.hammer}</span>
            Uplift & Value-Add Strategies
          </h2>
          
          {hasStrategies ? (
            <div className="pdf-strategies-grid">
              {data.valueAddStrategies!.map((strategy, i) => (
                <div key={i} className="pdf-strategy-card">
                  <div className="pdf-strategy-header">
                    <h3 className="pdf-strategy-title">{strategy.title}</h3>
                    {/* SINGLE badge per card - state-aware */}
                    <ApprovalBadge 
                      type={strategy.planningPathway} 
                      propertyState={propertyState}
                      isStrata={isStrata}
                    />
                  </div>
                  <p className="pdf-strategy-desc">{strategy.description}</p>
                  <div className="pdf-strategy-metrics">
                    <div className="pdf-strategy-metric">
                      <span className="pdf-strategy-metric-label">Est. Cost</span>
                      <span className="pdf-strategy-metric-value">
                        {formatRange(strategy.estimatedCost?.low, strategy.estimatedCost?.high)}
                      </span>
                    </div>
                    <div className="pdf-strategy-metric pdf-strategy-metric-highlight">
                      <span className="pdf-strategy-metric-label">Potential Uplift</span>
                      <span className="pdf-strategy-metric-value">
                        {formatRange(strategy.estimatedUplift?.low, strategy.estimatedUplift?.high)}
                      </span>
                    </div>
                  </div>
                  <div className="pdf-strategy-effort">
                    <span className="pdf-effort-badge" data-effort={strategy.effort?.toLowerCase()}>
                      {strategy.effort || 'Medium'} Effort
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="pdf-no-data">No value-add strategies identified for this property.</p>
          )}
        </div>

        {/* Rental Position Summary */}
        {data.rentalPosition && (
          <div className="pdf-section">
            <h2 className="pdf-section-title">
              <span className="pdf-icon">{Icons.dollarSign}</span>
              Indicative Rental Position
            </h2>
            <div className="pdf-rental-row">
              <div className="pdf-rental-metric">
                <span className="pdf-rental-label">Weekly Rent</span>
                <span className="pdf-rental-value">
                  ${data.rentalPosition.estimatedWeeklyRent 
                    ? Math.round(data.rentalPosition.estimatedWeeklyRent).toLocaleString() 
                    : '—'}/wk
                </span>
              </div>
              <div className="pdf-rental-metric">
                <span className="pdf-rental-label">Annual Rent</span>
                <span className="pdf-rental-value">
                  {data.rentalPosition.estimatedWeeklyRent 
                    ? formatCurrency(Math.round(data.rentalPosition.estimatedWeeklyRent * 52)) 
                    : '—'}
                </span>
              </div>
              <div className="pdf-rental-metric pdf-cash-position">
                <span className="pdf-rental-label">Weekly Cash Position</span>
                <span className={`pdf-rental-value ${data.rentalPosition.estimatedCashPositionWeekly && data.rentalPosition.estimatedCashPositionWeekly < 0 ? 'pdf-negative' : 'pdf-positive'}`}>
                  {data.rentalPosition.estimatedCashPositionWeekly !== undefined 
                    ? `$${Math.round(data.rentalPosition.estimatedCashPositionWeekly).toLocaleString()}/wk`
                    : '—'}
                </span>
              </div>
            </div>
            {data.rentalPosition.repaymentAssumptionNotes && (
              <p className="pdf-rental-assumptions">
                {data.rentalPosition.repaymentAssumptionNotes}
              </p>
            )}
          </div>
        )}
      </PdfPage>

      {/* ================================================================
          PAGE 3: DEVELOPMENT SCENARIOS + APPROVAL PATHWAY + ZONING
          ================================================================ */}
      <PdfPage pageNum={3} totalPages={totalPages}>
        {/* Development Scenarios */}
        {hasScenarios && (
          <div className="pdf-section">
            <h2 className="pdf-section-title">
              <span className="pdf-icon">{Icons.building}</span>
              Development Scenarios
            </h2>
            <div className="pdf-scenarios-grid">
              {data.developmentScenarios!.map((scenario, i) => (
                <div key={i} className="pdf-scenario-card">
                  <div className="pdf-scenario-header">
                    <h3 className="pdf-scenario-title">{scenario.title}</h3>
                    {/* SINGLE badge - state-aware */}
                    <ApprovalBadge 
                      type={scenario.planningPathway}
                      propertyState={propertyState}
                      isStrata={isStrata}
                    />
                  </div>
                  <p className="pdf-scenario-desc">{scenario.description}</p>
                  <div className="pdf-scenario-metrics">
                    <div className="pdf-scenario-metric">
                      <span className="pdf-scenario-label">Build Cost</span>
                      <span className="pdf-scenario-value">
                        {formatRange(scenario.estimatedCost?.low, scenario.estimatedCost?.high)}
                      </span>
                    </div>
                    {(() => {
                      const low = scenario.estimatedNetProfit?.low || 0;
                      const high = scenario.estimatedNetProfit?.high || 0;
                      const isOverallNegative = (low + high) < 0;
                      
                      // Color logic: dominant sentiment gets theme color, opposite gets cream/amber
                      const getLowColor = () => {
                        if (low < 0) return isOverallNegative ? '#B91C1C' : '#92400E'; // red or amber
                        return isOverallNegative ? '#92400E' : '#065F46'; // amber or green
                      };
                      const getHighColor = () => {
                        if (high < 0) return isOverallNegative ? '#B91C1C' : '#92400E';
                        return isOverallNegative ? '#92400E' : '#065F46';
                      };
                      
                      return (
                        <div 
                          className="pdf-scenario-metric"
                          style={{
                            background: isOverallNegative ? '#FEF2F2' : '#ECFDF5',
                            border: isOverallNegative ? '1px solid #FECACA' : '1px solid #A7F3D0'
                          }}
                        >
                          <span className="pdf-scenario-label" style={{ color: isOverallNegative ? '#DC2626' : '#047857' }}>
                            Potential Uplift
                          </span>
                          <span className="pdf-scenario-value">
                            <span style={{ color: getLowColor() }}>{formatCurrency(scenario.estimatedNetProfit?.low)}</span>
                            <span style={{ color: '#6B7280' }}> – </span>
                            <span style={{ color: getHighColor() }}>{formatCurrency(scenario.estimatedNetProfit?.high)}</span>
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approval Pathway */}
        {data.approvalPathway?.likelyPathway && (
          <div className="pdf-section">
            <h2 className="pdf-section-title">
              <span className="pdf-icon">{Icons.shield}</span>
              Likely Approval Pathway
            </h2>
            <div className="pdf-approval-card">
              <ApprovalBadge 
                type={data.approvalPathway.likelyPathway} 
                className="pdf-approval-badge-large"
                propertyState={propertyState}
                isStrata={isStrata}
              />
              <p className="pdf-approval-explanation">{replaceStateTerminology(data.approvalPathway.explanation, propertyState)}</p>
              <p className="pdf-approval-note">
                Indicative pathway only. Consult a qualified town planner for site-specific advice.
              </p>
            </div>
          </div>
        )}

        {/* Zoning Intel */}
        {data.zoningIntel?.currentZoneCode && (
          <div className="pdf-section">
            <h2 className="pdf-section-title">
              <span className="pdf-icon">{Icons.tag}</span>
              Zoning Information
            </h2>
            <div className="pdf-zoning-card">
              <div className="pdf-zoning-code">
                <span className="pdf-zoning-code-label">Zone Code</span>
                <span className="pdf-zoning-code-value">{data.zoningIntel.currentZoneCode}</span>
                <span className="pdf-zoning-code-title">{data.zoningIntel.currentZoneTitle}</span>
              </div>
              <p className="pdf-zoning-meaning">{data.zoningIntel.whatItMeans}</p>
              <p className="pdf-zoning-note">
                Verify current zoning and controls via the local LEP/DCP or council planning portal.
              </p>
            </div>
          </div>
        )}
      </PdfPage>

      {/* ================================================================
          PAGE 4: COMPARABLES TABLE + WATCH-OUTS
          ================================================================ */}
      <PdfPage pageNum={4} totalPages={totalPages}>
        {/* Comparable Sales Table - Only verified sold properties */}
        <div className="pdf-section">
          <h2 className="pdf-section-title">
            <span className="pdf-icon">{Icons.tag}</span>
            Comparable Market Sales
          </h2>
          <p className="pdf-section-subtitle">Recently sold within 2km (18 months)</p>
          
          {hasComparables ? (
            <>
              <table className="pdf-comparables-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Sold Date</th>
                    <th>Sale Price</th>
                    <th>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComparables.map((sale, i) => (
                    <tr key={i}>
                      <td className="pdf-comp-address">{sale.addressShort || '—'}</td>
                      <td>{sale.date || '—'}</td>
                      <td className="pdf-comp-price">{formatCurrency(sale.price)}</td>
                      <td>{sale.distanceKm ? `${sale.distanceKm}km` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="pdf-table-note">
                Verified sold comparables only. Condition, aspect and land size affect relevance.
              </p>
            </>
          ) : (
            <p className="pdf-table-note" style={{ fontStyle: 'italic', color: '#6b7280' }}>
              {comparablesFallback || 'Not enough recent sold comparables found for this area.'}
            </p>
          )}
        </div>

        {/* Watch Outs */}
        {hasWatchOuts && (
          <div className="pdf-section">
            <h2 className="pdf-section-title pdf-section-title-warning">
              <span className="pdf-icon">{Icons.alertTriangle}</span>
              Watch Outs
            </h2>
            <div className="pdf-watchouts-list">
              {data.watchOuts!.map((wo, i) => (
                <div key={i} className="pdf-watchout-item">
                  <span className="pdf-watchout-severity" data-severity={wo.severity?.toLowerCase()}>
                    {wo.severity === 'HIGH' ? '⚠️' : wo.severity === 'MEDIUM' ? '⚡' : 'ℹ️'}
                  </span>
                  <div className="pdf-watchout-content">
                    <h4 className="pdf-watchout-title">{wo.title}</h4>
                    <p className="pdf-watchout-desc">{wo.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Context */}
        {data.marketContext && (
          <div className="pdf-section">
            <h2 className="pdf-section-title">
              <span className="pdf-icon">{Icons.trendingUp}</span>
              Market Context
            </h2>
            <div className="pdf-market-grid">
              <div className="pdf-market-item">
                <span className="pdf-market-label">Suburb Median</span>
                <span className="pdf-market-value">{formatCurrency(data.marketContext.suburbMedian)}</span>
              </div>
              <div className="pdf-market-item">
                <span className="pdf-market-label">Days on Market</span>
                <span className="pdf-market-value">{data.marketContext.daysOnMarket || '—'}</span>
              </div>
              <div className="pdf-market-item">
                <span className="pdf-market-label">Auction Clearance</span>
                <span className="pdf-market-value">{data.marketContext.auctionClearance || '—'}</span>
              </div>
              <div className="pdf-market-item">
                <span className="pdf-market-label">Rental Vacancy</span>
                <span className="pdf-market-value">{data.marketContext.rentalVacancy || '—'}</span>
              </div>
            </div>
          </div>
        )}
      </PdfPage>

      {/* ================================================================
          PAGE 5+: AI VISUALISATIONS (Only if visuals exist)
          ================================================================ */}
      {hasVisualizations && (
        <>
          {allVisualizations.length === 1 ? (
            // SINGLE IMAGE: Full page layout - AI generated only
            <PdfPage pageNum={5} totalPages={totalPages}>
              <div className="pdf-section" style={{ background: '#fff' }}>
                <h2 className="pdf-section-title">
                  <span className="pdf-icon">{Icons.home}</span>
                  AI Visualisations
                </h2>
                <p className="pdf-section-subtitle">AI-generated concept imagery for property potential</p>
                
                <div style={{ marginTop: '16px', background: '#ffffff', border: '1px solid #E5E2DD', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#3A342D', marginBottom: '12px' }}>
                    {allVisualizations[0].strategyType === 'development' ? '🏗️' : '🔨'} {allVisualizations[0].strategyName}
                  </p>
                  
                  <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #E5E2DD', maxHeight: '450px' }}>
                    <img 
                      src={allVisualizations[0].visual.afterImage} 
                      alt="AI visualisation"
                      style={{ width: '100%', height: '450px', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                  
                  <p style={{ fontSize: '8px', color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '12px' }}>
                    AI-generated concept only. Actual results may vary. Consult qualified professionals.
                  </p>
                </div>
              </div>
            </PdfPage>
          ) : (
            // MULTIPLE IMAGES: 2 per page with 280px height each
            <>
              {Array.from({ length: visualizationPages }).map((_, pageIndex) => {
                const startIdx = pageIndex * 2;
                const pageVisuals = allVisualizations.slice(startIdx, startIdx + 2);
                
                return (
                  <PdfPage key={`visual-page-${pageIndex}`} pageNum={5 + pageIndex} totalPages={totalPages}>
                    <div className="pdf-section" style={{ background: '#fff' }}>
                      {pageIndex === 0 && (
                        <>
                          <h2 className="pdf-section-title">
                            <span className="pdf-icon">{Icons.home}</span>
                            AI Visualisations
                          </h2>
                          <p className="pdf-section-subtitle">AI-generated concept imagery for property potential</p>
                        </>
                      )}
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px', background: '#ffffff' }}>
                        {pageVisuals.map((item, idx) => (
                          <div key={idx} style={{ background: '#ffffff', border: '1px solid #E5E2DD', borderRadius: '12px', padding: '16px' }}>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#3A342D', marginBottom: '12px' }}>
                              {item.strategyType === 'development' ? '🏗️' : '🔨'} {item.strategyName}
                            </p>
                            
                            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #E5E2DD', maxHeight: '280px' }}>
                              <img 
                                src={item.visual.afterImage} 
                                alt="AI visualisation"
                                style={{ width: '100%', height: '280px', objectFit: 'cover', display: 'block' }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {pageIndex === visualizationPages - 1 && (
                        <p style={{ fontSize: '8px', color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '12px' }}>
                          AI-generated concepts only. Actual results may vary. Consult qualified professionals.
                        </p>
                      )}
                    </div>
                  </PdfPage>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default PdfReport;

// ============================================================================
// PDF STYLES - Embedded in the PDF HTML document
// ============================================================================
export const getPdfDocumentStyles = () => `
  /* ===== RESET & BASE ===== */
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 10.5px;
    line-height: 1.4;
    color: #3A342D;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ===== NO TRUNCATION ANYWHERE ===== */
  .pdf-document * {
    text-overflow: initial !important;
    overflow: visible !important;
    white-space: normal !important;
  }

  /* ===== A4 PAGE STRUCTURE ===== */
  .pdf-page {
    width: 210mm;
    min-height: 297mm;
    padding: 8mm;
    padding-top: 16mm;
    padding-bottom: 16mm;
    page-break-after: always;
    position: relative;
    background: #fff;
  }
  .pdf-page:last-child {
    page-break-after: auto;
  }

  /* Page Header */
  .pdf-page-header {
    position: absolute;
    top: 8mm;
    left: 8mm;
    right: 8mm;
    padding-bottom: 4mm;
    border-bottom: 1px solid #E5E2DD;
  }
  .pdf-header-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pdf-header-logo {
    font-size: 12px;
    font-weight: 800;
    color: #C9A961;
    letter-spacing: -0.5px;
  }
  .pdf-header-divider {
    color: #E5E2DD;
  }
  .pdf-header-title {
    font-size: 9px;
    font-weight: 500;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  /* Page Footer */
  .pdf-page-footer {
    position: absolute;
    bottom: 8mm;
    left: 8mm;
    right: 8mm;
    padding-top: 4mm;
    border-top: 1px solid #E5E2DD;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .pdf-footer-disclaimer {
    font-size: 7px;
    color: #999;
    max-width: 70%;
  }
  .pdf-footer-page {
    font-size: 8px;
    font-weight: 600;
    color: #666;
  }

  /* Page Content */
  .pdf-page-content {
    padding-top: 8mm;
    padding-bottom: 8mm;
  }

  /* ===== PROPERTY HEADER ===== */
  .pdf-property-header {
    margin-bottom: 16px;
  }
  .pdf-property-badge {
    display: inline-block;
    padding: 4px 12px;
    background: #C9A961;
    color: #fff;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    border-radius: 4px;
    margin-bottom: 8px;
  }
  .pdf-property-address {
    font-size: 24px;
    font-weight: 700;
    color: #3A342D;
    line-height: 1.15;
    margin-bottom: 4px;
    letter-spacing: -0.5px;
  }
  .pdf-property-meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .pdf-property-meta {
    font-size: 11px;
    color: #777;
  }
  .pdf-combined-lots-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #F3E8FF;
    color: #7C3AED;
    border-radius: 20px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* ===== METRICS ROW ===== */
  .pdf-metrics-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    padding: 16px;
    background: #FAFAF8;
    border-radius: 12px;
    border: 1px solid #E5E2DD;
    margin-bottom: 24px;
  }
  .pdf-metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pdf-metric-label {
    font-size: 7px;
    font-weight: 700;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .pdf-metric-value {
    font-size: 14px;
    font-weight: 800;
    color: #3A342D;
  }
  .pdf-metric-highlight {
    color: #8A9A6D;
  }

  /* ===== MAP ===== */
  .pdf-map-container {
    width: 100%;
    height: 250px;
    border-radius: 12px;
    overflow: hidden;
    margin-top: 130px;
    margin-bottom: 150px;
    background: #f5f5f5;
    position: relative;
    z-index: 1;
  }
  .pdf-map-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .pdf-map-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #999;
    font-size: 11px;
  }

  /* ===== SECTIONS ===== */
  .pdf-section {
    margin-top: 20px;
    margin-bottom: 20px;
    clear: both;
  }
  .pdf-section-after-map {
    margin-top: 0;
  }
  .pdf-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: #3A342D;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid #C9A961;
  }
  .pdf-section-title-warning {
    border-bottom-color: #ef4444;
  }
  .pdf-section-subtitle {
    font-size: 9px;
    color: #888;
    margin-top: -8px;
    margin-bottom: 12px;
  }
  .pdf-icon {
    width: 18px;
    height: 18px;
    color: #C9A961;
  }

  /* ===== AMENITIES GRID ===== */
  .pdf-amenities-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .pdf-amenity-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #FAFAF8;
    border-radius: 8px;
    border: 1px solid #E5E2DD;
  }
  .pdf-amenity-icon {
    width: 20px;
    height: 20px;
    color: #C9A961;
  }
  .pdf-amenity-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .pdf-amenity-name {
    font-size: 10px;
    font-weight: 600;
    color: #3A342D;
  }
  .pdf-amenity-distance {
    font-size: 9px;
    color: #888;
  }

  /* ===== STRATEGY CARDS ===== */
  .pdf-strategies-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .pdf-strategy-card {
    padding: 14px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #E5E2DD;
    display: flex;
    flex-direction: column;
    min-height: 160px;
  }
  .pdf-strategy-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }
  .pdf-strategy-title {
    font-size: 12px;
    font-weight: 700;
    color: #3A342D;
    line-height: 1.25;
    flex: 1;
  }
  .pdf-strategy-desc {
    font-size: 9px;
    color: #666;
    line-height: 1.45;
    margin-bottom: 12px;
    flex: 1;
  }
  .pdf-strategy-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 8px;
  }
  .pdf-strategy-metric {
    padding: 8px;
    background: #FAFAF8;
    border-radius: 6px;
  }
  .pdf-strategy-metric-highlight {
    background: #ecfdf5;
  }
  .pdf-strategy-metric-label {
    display: block;
    font-size: 7px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .pdf-strategy-metric-value {
    font-size: 10px;
    font-weight: 700;
    color: #3A342D;
  }
  .pdf-strategy-metric-highlight .pdf-strategy-metric-value {
    color: #059669;
  }
  .pdf-strategy-effort {
    margin-top: auto;
  }
  .pdf-effort-badge {
    display: inline-block;
    padding: 3px 8px;
    font-size: 7px;
    font-weight: 700;
    text-transform: uppercase;
    border-radius: 4px;
    background: #f1f5f9;
    color: #64748b;
  }
  .pdf-effort-badge[data-effort="low"] {
    background: #dcfce7;
    color: #16a34a;
  }
  .pdf-effort-badge[data-effort="high"] {
    background: #fef2f2;
    color: #dc2626;
  }

  /* ===== RENTAL ROW ===== */
  .pdf-rental-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .pdf-rental-metric {
    padding: 14px;
    background: #FAFAF8;
    border-radius: 10px;
    border: 1px solid #E5E2DD;
    text-align: center;
  }
  .pdf-rental-label {
    display: block;
    font-size: 8px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .pdf-rental-value {
    font-size: 16px;
    font-weight: 800;
    color: #3A342D;
  }
  .pdf-rental-value.pdf-negative {
    color: #C53030;
  }
  .pdf-rental-value.pdf-positive {
    color: #276749;
  }
  .pdf-cash-position {
    background: #1B365D;
    border-color: #1B365D;
  }
  .pdf-cash-position .pdf-rental-label {
    color: #A8A8A8;
  }
  .pdf-cash-position .pdf-rental-value {
    color: white;
  }
  .pdf-cash-position .pdf-rental-value.pdf-negative {
    color: #FC8181;
  }
  .pdf-cash-position .pdf-rental-value.pdf-positive {
    color: #68D391;
  }
  .pdf-rental-assumptions {
    font-size: 8px;
    color: #78716c;
    font-style: italic;
    margin-top: 8px;
    text-align: center;
  }

  /* ===== SCENARIOS ===== */
  .pdf-scenarios-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .pdf-scenario-card {
    padding: 14px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #E5E2DD;
  }
  .pdf-scenario-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }
  .pdf-scenario-title {
    font-size: 12px;
    font-weight: 700;
    color: #3A342D;
  }
  .pdf-scenario-desc {
    font-size: 9px;
    color: #666;
    line-height: 1.45;
    margin-bottom: 12px;
  }
  .pdf-scenario-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .pdf-scenario-metric {
    padding: 8px;
    background: #FAFAF8;
    border-radius: 6px;
  }
  .pdf-scenario-profit {
    background: #ECFDF5;
    border: 1px solid #A7F3D0;
  }
  .pdf-scenario-profit .pdf-scenario-label {
    color: #047857;
  }
  .pdf-scenario-profit .pdf-scenario-value {
    color: #065F46;
  }
  .pdf-scenario-label {
    display: block;
    font-size: 7px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .pdf-scenario-value {
    font-size: 10px;
    font-weight: 700;
    color: #3A342D;
  }

  /* ===== APPROVAL CARD ===== */
  .pdf-approval-card {
    padding: 16px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }
  .pdf-approval-badge-large {
    font-size: 10px !important;
    padding: 5px 12px !important;
    margin-bottom: 10px;
    display: inline-block;
  }
  .pdf-approval-explanation {
    font-size: 10px;
    color: #444;
    line-height: 1.5;
    margin-bottom: 10px;
  }
  .pdf-approval-note {
    font-size: 8px;
    color: #888;
    font-style: italic;
  }

  /* ===== ZONING CARD ===== */
  .pdf-zoning-card {
    padding: 16px;
    background: #f0fdf4;
    border-radius: 12px;
    border: 1px solid #bbf7d0;
  }
  .pdf-zoning-code {
    text-align: center;
    padding: 12px;
    background: #fff;
    border-radius: 8px;
    margin-bottom: 12px;
  }
  .pdf-zoning-code-label {
    display: block;
    font-size: 7px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .pdf-zoning-code-value {
    display: block;
    font-size: 20px;
    font-weight: 800;
    color: #3A342D;
    letter-spacing: 2px;
  }
  .pdf-zoning-code-title {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: #16a34a;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .pdf-zoning-meaning {
    font-size: 10px;
    color: #444;
    line-height: 1.5;
    margin-bottom: 10px;
  }
  .pdf-zoning-note {
    font-size: 8px;
    color: #888;
    font-style: italic;
  }

  /* ===== COMPARABLES TABLE ===== */
  .pdf-comparables-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    margin-bottom: 8px;
  }
  .pdf-comparables-table th {
    background: #f8fafc;
    padding: 8px 6px;
    text-align: left;
    font-weight: 700;
    font-size: 8px;
    text-transform: uppercase;
    color: #666;
    border-bottom: 2px solid #e2e8f0;
  }
  .pdf-comparables-table td {
    padding: 8px 6px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }
  .pdf-comparables-table tr:nth-child(even) td {
    background: #fafafa;
  }
  .pdf-comp-address {
    font-weight: 500;
    max-width: 160px;
  }
  .pdf-comp-price {
    font-weight: 700;
    color: #059669;
  }
  .pdf-table-note {
    font-size: 8px;
    color: #888;
    font-style: italic;
  }

  /* ===== WATCH OUTS ===== */
  .pdf-watchouts-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .pdf-watchout-item {
    display: flex;
    gap: 10px;
    padding: 12px;
    background: #fef2f2;
    border-radius: 10px;
    border: 1px solid #fecaca;
  }
  .pdf-watchout-severity {
    font-size: 16px;
    flex-shrink: 0;
  }
  .pdf-watchout-content {
    flex: 1;
  }
  .pdf-watchout-title {
    font-size: 11px;
    font-weight: 700;
    color: #3A342D;
    margin-bottom: 4px;
  }
  .pdf-watchout-desc {
    font-size: 9px;
    color: #666;
    line-height: 1.45;
  }

  /* ===== MARKET GRID ===== */
  .pdf-market-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .pdf-market-item {
    padding: 12px;
    background: #FAFAF8;
    border-radius: 8px;
    border: 1px solid #E5E2DD;
    text-align: center;
  }
  .pdf-market-label {
    display: block;
    font-size: 7px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .pdf-market-value {
    font-size: 12px;
    font-weight: 700;
    color: #3A342D;
  }

  /* ===== NO DATA ===== */
  .pdf-no-data {
    padding: 20px;
    text-align: center;
    color: #888;
    font-size: 10px;
    background: #fafafa;
    border-radius: 8px;
  }

  /* ===== AI VISUALISATIONS ===== */
  .pdf-visual-single {
    margin-top: 16px;
  }
  
  .pdf-visual-strategy-ref {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding: 10px 14px;
    background: linear-gradient(135deg, #FAFAF8 0%, #F5F3F0 100%);
    border-radius: 10px;
    border: 1px solid #E5E2DD;
  }
  
  .pdf-visual-strategy-badge {
    font-size: 16px;
  }
  
  .pdf-visual-strategy-name {
    font-size: 13px;
    font-weight: 700;
    color: #3A342D;
    letter-spacing: -0.3px;
  }
  
  .pdf-visual-single-image {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #E5E2DD;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    margin-bottom: 16px;
    width: 100%;
    height: 485px;
  }
  
  .pdf-visual-single-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  
  .pdf-visual-image-large {
    width: 100%;
    height: 485px;
    object-fit: cover;
    display: block;
  }
  
  .pdf-visual-image {
    width: 100%;
    height: 165px;
    object-fit: cover;
    display: block;
  }
  
  .pdf-visual-image-medium {
    width: 100%;
    height: 265px;
    object-fit: cover;
    display: block;
    border-radius: 10px;
  }
  
  /* Stack layout for 2 per page */
  .pdf-visuals-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 12px;
  }
  
  .pdf-visual-item {
    background: #FAFAF8;
    border: 1px solid #E5E2DD;
    border-radius: 12px;
    padding: 12px;
  }
  
  .pdf-visual-image-container {
    position: relative;
    border-radius: 10px;
    overflow: hidden;
    width: 100%;
    height: 265px;
  }
  
  .pdf-visual-image-container img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  
  .pdf-visual-label {
    position: absolute;
    bottom: 12px;
    left: 12px;
    padding: 6px 14px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: 6px;
    background: #C9A961;
    color: #fff;
  }
  
  .pdf-visual-label-after {
    background: #C9A961;
    color: #fff;
  }
  
  .pdf-visual-disclaimer {
    font-size: 8px;
    color: #888;
    font-style: italic;
    text-align: center;
    padding: 12px;
    background: #FAFAF8;
    border-radius: 8px;
    border: 1px solid #E5E2DD;
  }
  
  /* Multiple visuals grid */
  .pdf-visuals-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 16px;
  }
  
  .pdf-visual-card {
    padding: 14px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #E5E2DD;
  }
  
  .pdf-visual-single-card {
    position: relative;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #E5E2DD;
    margin-top: 10px;
  }
  
  .pdf-visual-label-small {
    position: absolute;
    bottom: 6px;
    left: 6px;
    padding: 4px 10px;
    font-size: 7px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: 4px;
    background: #C9A961;
    color: #fff;
  }
  
  .pdf-visual-label-after-small {
    background: #C9A961;
  }

  /* ===== PRINT MEDIA ===== */
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-page {
      page-break-after: always;
    }
    .pdf-page:last-child {
      page-break-after: auto;
    }
  }
`;

