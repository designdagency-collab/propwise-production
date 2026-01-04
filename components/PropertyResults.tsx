import React, { useState, useRef, useEffect, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PropertyData, PlanType, DevEligibility, Amenity } from '../types';
import PdfReport, { getPdfDocumentStyles } from './pdf/PdfReport';
import { 
  extractStateFromAddress, 
  getStateAwarePathwayLabel, 
  getStateAwarePathwayTooltip,
  replaceStateTerminology,
  AusState 
} from '../services/approvalPathways';
import {
  getPrimaryAreaDisplay,
  filterSoldComparables,
  getComparablesFallbackMessage
} from '../services/propertyUtils';
import { computeUpblockScore, mapPropertyDataToScoreInputs, ScoreResult } from '../src/utils/upblockScore';
import { UpblockScoreCard } from '../src/components/UpblockScoreCard';

interface PropertyResultsProps {
  data: PropertyData;
  address: string;
  plan: PlanType;
  onUpgrade: () => void;
  onHome: () => void;
}

const PropertyResults: React.FC<PropertyResultsProps> = ({ data, address, plan, onUpgrade, onHome }) => {
  const [selectedStrategies, setSelectedStrategies] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [pdfCountdown, setPdfCountdown] = useState<number>(3);
  const [pdfReady, setPdfReady] = useState<boolean>(false);
  const [isScoreExpanded, setIsScoreExpanded] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Extract Australian state from address for state-aware approval badges
  const propertyState = useMemo(() => extractStateFromAddress(address), [address]);

  // PDF countdown timer - gives page time to fully render before allowing export
  useEffect(() => {
    if (data && !pdfReady) {
      setPdfCountdown(3);
      const timer = setInterval(() => {
        setPdfCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setPdfReady(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [data]);

  const isPaidUser = plan === 'PRO' || plan === 'UNLIMITED_PRO' || plan === 'STARTER_PACK';

  const isStrata = (data.propertyType || '').toLowerCase().match(/apartment|unit|townhouse|villa|strata|flat|duplex/);

  const formatValue = (val: any, prefix: string = '$'): string => {
    if (val === undefined || val === null || val === '') return 'TBA';
    if (typeof val === 'string' && val.trim() !== '') return val;
    if (typeof val === 'number') {
      return prefix + new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 }).format(val);
    }
    return 'TBA';
  };

  // Helper to determine color based on value (red for negative, green for positive)
  const getValueColor = (val: any): string => {
    if (val === undefined || val === null) return 'text-emerald-700';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
    if (isNaN(num)) return 'text-emerald-700';
    return num < 0 ? 'text-red-600' : 'text-emerald-700';
  };

  const safeNum = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val.replace(/[^0-9.-]+/g, ""));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'Low': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Medium': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'High': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-500';
    }
  };

  const getEligibilityBadgeColor = (eligibility: DevEligibility) => {
    switch (eligibility) {
      case 'Allowed': return 'bg-emerald-500 text-white';
      case 'Likely': return 'bg-blue-500 text-white';
      case 'Uncertain': return 'bg-amber-500 text-white';
      case 'Not Allowed': return 'bg-rose-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'Critical': return <i className="fa-solid fa-circle-exclamation text-rose-500"></i>;
      case 'Warning': return <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>;
      default: return <i className="fa-solid fa-circle-info text-blue-500"></i>;
    }
  };

  // Consistent pathway labels - always show "(indicative)" to be legally safe
  // Now state-aware for Australian jurisdictions
  const getPathwayBadgeColor = (pathway: string) => {
    if (isStrata && pathway === 'Exempt') return 'bg-indigo-600 text-white';
    switch (pathway) {
      case 'Exempt': return 'bg-slate-500 text-white'; // Changed from green - less definitive
      case 'CDC': return 'bg-blue-500 text-white';
      case 'DA': return 'bg-amber-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  // Get display label - state-aware for Australian jurisdictions
  const getPathwayLabel = (pathway: string): string => {
    return getStateAwarePathwayLabel(pathway, propertyState, isStrata);
  };

  // Get tooltip description - state-aware for Australian jurisdictions
  const getPathwayDescription = (pathway: string) => {
    return getStateAwarePathwayTooltip(pathway, propertyState, isStrata);
  };

  const PathwayBadgeWithTooltip = ({ pathway }: { pathway: string }) => {
    const displayText = getPathwayLabel(pathway);
    return (
      <div className="group relative inline-block">
        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest cursor-help transition-opacity hover:opacity-90 ${getPathwayBadgeColor(pathway)}`}>
          {displayText}
        </span>
        {/* Tooltip - hidden in PDF via data-no-pdf */}
        <div data-no-pdf="true" className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#4A4137] text-white text-[9px] font-medium rounded-lg shadow-xl z-50 transition-all opacity-0 group-hover:opacity-100 pointer-events-none leading-relaxed text-center">
          {getPathwayDescription(pathway)}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#4A4137]"></div>
        </div>
      </div>
    );
  };

  const toggleStrategy = (index: number) => {
    const next = new Set(selectedStrategies);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedStrategies(next);
  };

  /**
   * Export report to PDF using server-side Puppeteer
   * 
   * NEW APPROACH: Render a dedicated PDF-only component (PdfReport.tsx)
   * instead of cloning the live UI DOM. This provides:
   * - Deterministic layout with explicit A4 pages
   * - No truncation or clipped text
   * - Single-source-of-truth badges (no duplicates)
   * - Clean tables for comparables
   * - Inline SVG icons (no CDN dependency)
   */
  const exportToPDF = async () => {
    if (!isPaidUser) return;
    
    setIsExporting(true);
    
    try {
      // 1. Pre-fetch static map image (with retries)
      let mapDataUrl: string | null = null;
      console.log('[PDF] Fetching static map for:', data.address);
      
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const staticMapUrl = `/api/static-map?address=${encodeURIComponent(data.address)}&width=1200&height=400&zoom=18`;
          console.log('[PDF] Map fetch attempt', attempt, staticMapUrl);
          
          const mapResponse = await fetch(staticMapUrl);
          const contentType = mapResponse.headers.get('content-type') || '';
          console.log('[PDF] Map response:', mapResponse.status, contentType);
          
          if (mapResponse.ok && (contentType.includes('image/png') || contentType.includes('image/jpeg'))) {
            const blob = await mapResponse.blob();
            console.log('[PDF] Map blob size:', blob.size);
            
            if (blob.size > 5000) {
              mapDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              console.log('[PDF] Map loaded successfully, dataUrl length:', mapDataUrl?.length);
              break;
            } else {
              console.warn('[PDF] Map blob too small:', blob.size);
            }
          } else {
            console.warn('[PDF] Map response not OK or wrong content type');
          }
          
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
        } catch (mapError) {
          console.warn('[PDF] Map fetch error:', mapError);
        }
      }
      
      console.log('[PDF] Final mapDataUrl:', mapDataUrl ? 'present (' + mapDataUrl.length + ' chars)' : 'null');

      // 2. Render the dedicated PDF component to HTML
      // This is the key change: we render a clean, print-first component
      // instead of cloning the messy live UI DOM
      console.log('[PDF] Rendering PDF template...');
      
      const pdfMarkup = renderToStaticMarkup(
        <PdfReport 
          data={data} 
          address={data.address} 
          mapImageUrl={mapDataUrl || undefined}
        />
      );

      // 3. Build complete HTML document
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=1240">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            ${getPdfDocumentStyles()}
          </style>
        </head>
        <body>
          ${pdfMarkup}
        </body>
        </html>
      `;

      const filename = `upblock-${data.address.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;

      // 4. Generate PDF via Puppeteer API
      console.log('[PDF] Sending to Puppeteer API...');
      
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlContent, filename })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.details || errorData.error || 'PDF generation failed');
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error('Server did not return a valid PDF');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('[PDF] Premium PDF export complete, size:', blob.size, 'bytes');
      
    } catch (error: any) {
      console.error('PDF export error:', error);
      alert(`Failed to export PDF: ${error.message || 'Please try again.'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getAmenityIcon = (type: Amenity['type']) => {
    switch (type) {
      case 'transport': return <i className="fa-solid fa-train-subway"></i>;
      case 'shopping': return <i className="fa-solid fa-cart-shopping"></i>;
      case 'education': return <i className="fa-solid fa-graduation-cap"></i>;
      case 'leisure': return <i className="fa-solid fa-tree"></i>;
      default: return <i className="fa-solid fa-location-dot"></i>;
    }
  };

  const getAmenityColor = (type: Amenity['type']) => {
    switch (type) {
      case 'transport': return 'text-blue-500 bg-blue-50';
      case 'shopping': return 'text-amber-500 bg-amber-50';
      case 'education': return 'text-emerald-500 bg-emerald-50';
      case 'leisure': return 'text-rose-500 bg-rose-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  if (!data) return null;

  const findBestStrategyIndex = () => {
    if (!data.valueAddStrategies || data.valueAddStrategies.length === 0) return -1;
    const bestTitle = data.portfolioSelloutSummary?.bestStrategyByProfit;
    if (bestTitle) {
      const index = data.valueAddStrategies.findIndex(s => s.title.trim().toLowerCase() === bestTitle.trim().toLowerCase());
      if (index !== -1) return index;
    }
    let maxIdx = 0;
    data.valueAddStrategies.forEach((s, idx) => {
      if (safeNum(s.estimatedUplift?.high) > safeNum(data.valueAddStrategies[maxIdx]?.estimatedUplift?.high)) {
        maxIdx = idx;
      }
    });
    return maxIdx;
  };

  const effectiveSelection = selectedStrategies.size > 0 
    ? selectedStrategies 
    : (data.valueAddStrategies && data.valueAddStrategies.length > 0 ? new Set([findBestStrategyIndex()]) : new Set<number>());

  const baseline = data?.valueSnapshot?.indicativeMidpoint;
  let totalUpliftLow = 0;
  let totalUpliftHigh = 0;
  effectiveSelection.forEach(idx => {
    const s = data.valueAddStrategies[idx];
    if (s) {
      totalUpliftLow += safeNum(s.estimatedUplift?.low);
      totalUpliftHigh += safeNum(s.estimatedUplift?.high);
    }
  });

  const afterLow = baseline !== undefined ? baseline + totalUpliftLow : undefined;
  const afterHigh = baseline !== undefined ? baseline + totalUpliftHigh : undefined;

  // Use Google Maps embed (basic embed doesn't require API key)
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(data.address)}&t=k&z=17&ie=UTF8&iwloc=&output=embed`;

  // Filter out transport as requested
  const filteredProximity = data.proximity?.filter(a => a.type !== 'transport') || [];

  // Cash flow color logic
  const cashPos = data.rentalPosition?.estimatedCashPositionWeekly;
  const isPositive = cashPos !== undefined && cashPos >= 0;
  const isNegative = cashPos !== undefined && cashPos < 0;

  // Compute Upblock Deal Score
  const scoreInputs = useMemo(() => mapPropertyDataToScoreInputs(data), [data]);
  const upblockScore = useMemo(() => computeUpblockScore(scoreInputs), [scoreInputs]);
  // Strictly use red/green for the font
  const cashColorClass = isPositive ? 'text-[#10B981]' : isNegative ? 'text-[#E11D48]' : 'text-[#3A342D]';

  return (
    <div ref={reportRef} id="property-report" data-pdf-root="true" className="max-w-4xl mx-auto space-y-12 pb-32 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* Header Property Summary */}
      <div className="p-5 sm:p-8 md:p-12 rounded-[2rem] sm:rounded-[3rem] border shadow-sm relative overflow-hidden pdf-no-break" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D6A270]/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="space-y-4 sm:space-y-6 relative z-10">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-[#D6A270] rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider sm:tracking-[0.2em]" style={{ backgroundColor: 'var(--accent-gold-light)' }}>
                <span className="hidden sm:inline">Property</span> Strategy Guide
              </div>
              
              {/* Export PDF Button - Hidden in PDF export */}
              {isPaidUser ? (
                <button 
                  onClick={exportToPDF}
                  disabled={isExporting || !pdfReady}
                  data-no-pdf="true"
                  className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1 ${!pdfReady ? 'opacity-60 cursor-wait' : 'hover:text-[#D6A270]'} disabled:opacity-50`}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {isExporting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      Exporting...
                    </>
                  ) : !pdfReady ? (
                    <>
                      <i className="fa-solid fa-hourglass-half"></i>
                      PDF Ready in {pdfCountdown}...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-file-pdf"></i>
                      Export PDF
                    </>
                  )}
                </button>
              ) : (
                <button 
                  onClick={onUpgrade}
                  data-no-pdf="true"
                  className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:text-[#D6A270] transition-colors flex items-center gap-1.5" 
                  style={{ color: 'var(--text-muted)' }}
                >
                  <i className="fa-solid fa-lock text-[#C9A961] text-[8px]"></i>
                  Export PDF <span className="text-[#C9A961]">(Pro)</span>
                </button>
              )}
            </div>
            <div className="flex gap-3 sm:gap-4" data-pdf-attributes>
               <div className="flex items-center gap-1.5 sm:gap-2 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-bed text-[#D6A270]"></i> {data?.attributes?.beds || 0}
               </div>
               <div className="flex items-center gap-1.5 sm:gap-2 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-bath text-[#D6A270]"></i> {data?.attributes?.baths || 0}
               </div>
               <div className="flex items-center gap-1.5 sm:gap-2 font-bold text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-car text-[#D6A270]"></i> {data?.attributes?.cars || 0}
               </div>
            </div>
          </div>
          <div>
            <h1 className="text-[2rem] sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter font-address leading-tight" style={{ color: 'var(--text-primary)' }}>{data.address}</h1>
            <div className="flex items-center justify-between gap-3 mt-2">
              <div className="flex items-center gap-3">
                <p className="font-medium text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
                  {data.propertyType} • {getPrimaryAreaDisplay(data.landSize, data.propertyType).label} • {getPrimaryAreaDisplay(data.landSize, data.propertyType).value}
                </p>
                {data.isCombinedLots && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 text-purple-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    <i className="fa-solid fa-layer-group text-[8px]"></i>
                    Combined Lots
                  </span>
                )}
              </div>
              {/* Deal Score - Inline with property type */}
              <button 
                onClick={() => setIsScoreExpanded(!isScoreExpanded)}
                className="flex items-center gap-3 px-4 py-2 rounded-xl border hover:bg-black/[0.02] transition-colors"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                   Deal Score
                   <i className={`fa-solid fa-chevron-${isScoreExpanded ? 'up' : 'down'} text-[8px]`}></i>
                </span>
                <span className="text-xl font-black flex items-center gap-0.5" style={{ color: '#C9A961' }}>
                   {upblockScore.scoreRange 
                     ? `${upblockScore.scoreRange.low}–${upblockScore.scoreRange.high}` 
                     : upblockScore.score}
                   <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>/100</span>
                </span>
              </button>
            </div>
          </div>

          {/* 4 Metrics Row */}
          <div className="flex flex-wrap items-start justify-between gap-y-4 pt-6 mt-4 border-t" style={{ borderColor: 'var(--border-color)' }} data-pdf-kpi-row>
             <div className="space-y-0.5" data-pdf-kpi>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Market Value</p>
                <p className="text-xl sm:text-2xl font-black text-[#B8864A]">{formatValue(data?.valueSnapshot?.indicativeMidpoint)}</p>
             </div>
             <div className="space-y-0.5" data-pdf-kpi>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Post-Improvement</p>
                <p className={`text-xl sm:text-2xl font-black transition-colors whitespace-nowrap ${effectiveSelection.size > 0 ? 'text-[#8A9A6D]' : ''}`} style={{ color: effectiveSelection.size > 0 ? '#8A9A6D' : 'var(--text-primary)' }}>
                   {baseline === undefined ? 'TBA' : effectiveSelection.size === 0 ? formatValue(baseline) : `${formatValue(afterLow)} – ${formatValue(afterHigh)}`}
                </p>
             </div>
             <div className="space-y-0.5" data-pdf-kpi>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Growth (5yr)</p>
                <p className="text-xl sm:text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{data?.valueSnapshot?.growth || 'TBA'}</p>
             </div>
             <div className="space-y-0.5 group relative" data-pdf-kpi>
                <p className="text-[10px] font-bold uppercase tracking-widest cursor-help" style={{ color: 'var(--text-muted)' }}>Data Confidence</p>
                <p className="text-xl sm:text-2xl font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                   {data?.valueSnapshot?.confidenceLevel || 'Low'}
                   <i className={`fa-solid fa-circle-info text-xs cursor-help ${data?.valueSnapshot?.confidenceLevel === 'High' ? 'text-emerald-500' : 'text-amber-500'}`}></i>
                </p>
                {/* Confidence tooltip */}
                <div className="invisible group-hover:visible absolute bottom-full left-0 mb-2 w-52 p-3 bg-[#4A4137] text-white text-[9px] font-medium rounded-lg shadow-xl z-50 opacity-0 group-hover:opacity-100 pointer-events-none leading-relaxed">
                   <p className="font-bold mb-1">Based on:</p>
                   <ul className="space-y-0.5 text-white/80">
                     <li>• Recent comparable sales (12mo)</li>
                     <li>• Property data completeness</li>
                     <li>• Market activity in suburb</li>
                   </ul>
                </div>
             </div>
          </div>
          
          {/* Deal Score Breakdown - Expandable below metrics */}
          {isScoreExpanded && (
            <div className="mt-6">
              <UpblockScoreCard result={upblockScore} />
            </div>
          )}
        </div>
      </div>

      {/* GOOGLE MAP INTEGRATION - Replaced with static image in PDF export */}
      <div 
        data-map="true" 
        data-pdf-no-break
        className="w-full h-[400px] rounded-[3rem] overflow-hidden shadow-lg border relative group" 
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
         <div className="absolute inset-0 bg-slate-200/50 animate-pulse group-hover:hidden"></div>
         <iframe
          title="Property Location Map"
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={mapUrl}
          className="relative z-10 filter contrast-[1.1] grayscale-[0.2]"
        ></iframe>
      </div>

      {/* COMMUNITY & LIFESTYLE */}
      {(filteredProximity.length > 0) || data.localAreaIntel || data.localMarketVibe ? (
        <section className="space-y-6 pdf-no-break">
           <div className="flex items-center gap-4 px-4">
              <div className="w-10 h-10 bg-[#B8C5A0] text-white rounded-xl flex items-center justify-center shadow-md">
                <i className="fa-solid fa-map-pin"></i>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Proximity & Infrastructure</h2>
                <p className="text-[11px] sm:text-[10px] font-bold text-[#B8C5A0] uppercase tracking-widest mt-0.5">Local Amenities & Community DNA</p>
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-pdf-amenities>
              {filteredProximity.map((amenity, i) => (
                <div key={i} className="p-6 rounded-3xl border shadow-sm hover:shadow-md transition-shadow group" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${getAmenityColor(amenity.type)}`}>
                      {getAmenityIcon(amenity.type)}
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{amenity.type}</p>
                      <h4 className="text-sm font-bold leading-tight line-clamp-2" style={{ color: 'var(--text-primary)' }}>{amenity.name}</h4>
                      <p className="text-xs font-black text-[#B8C5A0]">{amenity.distance}</p>
                   </div>
                </div>
              ))}
           </div>

           {(data.localAreaIntel || data.localMarketVibe) && (
             <div className="p-10 rounded-[3rem] border shadow-sm space-y-8" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                {data.localAreaIntel?.schools && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-graduation-cap text-[#B8C5A0]"></i>
                      <h3 className="text-base sm:text-lg font-bold text-[#4A4137]">School Catchments</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <p className="text-[10px] font-black text-[#4A4137]/30 uppercase tracking-[0.2em]">Primary Schools</p>
                          <div className="space-y-4">
                             {data.localAreaIntel.schools.primary?.map((school, idx) => (
                               <div key={idx} className="flex items-start gap-3">
                                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                  <div>
                                     <p className="text-sm font-bold text-[#4A4137]">{school.name}</p>
                                     <p className="text-[10px] text-[#4A4137]/50">{school.distanceKm}km away</p>
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>
                       <div className="space-y-4">
                          <p className="text-[10px] font-black text-[#4A4137]/30 uppercase tracking-[0.2em]">Secondary Schools</p>
                          <div className="space-y-4">
                             {data.localAreaIntel.schools.secondary?.map((school, idx) => (
                               <div key={idx} className="flex items-start gap-3">
                                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                  <div>
                                     <p className="text-sm font-bold text-[#4A4137]">{school.name}</p>
                                     <p className="text-[10px] text-[#4A4137]/50">{school.distanceKm}km away</p>
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {/* TRANSPORT SECTION */}
                {data.localAreaIntel?.transport && (
                  <div className="space-y-6 pt-8 border-t border-slate-50">
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-bus text-[#B8C5A0]"></i>
                      <h3 className="text-base sm:text-lg font-bold text-[#4A4137]">Public Transport</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       {data.localAreaIntel.transport.trainStations && data.localAreaIntel.transport.trainStations.length > 0 && (
                         <div className="space-y-4">
                            <p className="text-[10px] font-black text-[#4A4137]/30 uppercase tracking-[0.2em]">Train Stations</p>
                            <div className="space-y-4">
                               {data.localAreaIntel.transport.trainStations.map((station, idx) => (
                                 <div key={idx} className="flex items-start gap-3">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    <div>
                                       <p className="text-sm font-bold text-[#4A4137]">{station.name}</p>
                                       <p className="text-[10px] text-[#4A4137]/50">
                                         {station.distanceKm}km away {station.typicalTravelTimeToCBD && ` • ${station.typicalTravelTimeToCBD} to CBD`}
                                       </p>
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>
                       )}
                       {data.localAreaIntel.transport.busStops && data.localAreaIntel.transport.busStops.length > 0 && (
                         <div className="space-y-4">
                            <p className="text-[10px] font-black text-[#4A4137]/30 uppercase tracking-[0.2em]">Key Bus Stops</p>
                            <div className="space-y-4">
                               {data.localAreaIntel.transport.busStops.map((stop, idx) => (
                                 <div key={idx} className="flex items-start gap-3">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                                    <div>
                                       <p className="text-sm font-bold text-[#4A4137]">{stop.name}</p>
                                       <p className="text-[10px] text-[#4A4137]/50">
                                         {stop.distanceKm}km away
                                       </p>
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>
                       )}
                    </div>
                  </div>
                )}

                {(data.localAreaIntel?.lifestyleSummary || data.localMarketVibe) && (
                  <div className="pt-8 border-t border-slate-50 space-y-4">
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-star text-[#B8C5A0]"></i>
                      <h3 className="text-base sm:text-lg font-bold text-[#4A4137]">Local Area Vibe</h3>
                    </div>
                    <p className="text-[10px] font-black text-[#4A4137]/30 uppercase tracking-[0.2em]">Community Insight</p>
                    <p className="text-sm text-[#4A4137]/60 italic leading-relaxed max-w-2xl">
                      "{data.localAreaIntel?.lifestyleSummary || data.localMarketVibe}"
                    </p>
                  </div>
                )}
             </div>
           )}
        </section>
      ) : null}

      {/* PORTFOLIO SELL-OUT SUMMARY */}
      {data.portfolioSelloutSummary && (
        <div data-pdf-callout data-pdf-no-break className="bg-[#4A4137] p-8 md:p-12 rounded-[3.5rem] text-white shadow-xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-[#D6A270]/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-[#D6A270]/20 transition-all duration-1000"></div>
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="flex-shrink-0 w-20 h-20 bg-[#D6A270] rounded-3xl flex items-center justify-center text-3xl shadow-lg">
                 <i className="fa-solid fa-sack-dollar"></i>
              </div>
              <div className="flex-grow space-y-4 text-center md:text-left">
                 <div>
                    <span className="text-[11px] sm:text-[10px] font-black text-[#D6A270] uppercase tracking-[0.3em] mb-1 block">Best Strategy Uplift</span>
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{data.portfolioSelloutSummary.bestStrategyByProfit}</h3>
                 </div>
                 <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="space-y-1">
                       <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Indicative Predicted Profit From Sale</p>
                       <p className="text-2xl sm:text-3xl font-black text-[#D6A270]">
                          {formatValue(data.portfolioSelloutSummary.estimatedNetProfitRange?.low)} – {formatValue(data.portfolioSelloutSummary.estimatedNetProfitRange?.high)}
                       </p>
                    </div>
                 </div>
                 <p className="text-sm text-white/60 leading-relaxed max-w-xl italic">"{data.portfolioSelloutSummary.selloutExplanation}"</p>
              </div>
           </div>
        </div>
      )}

      {/* VALUE-ADD STRATEGIES */}
      {data.valueAddStrategies && data.valueAddStrategies.length > 0 && (
        <section className="space-y-6 pdf-no-break" data-pdf-page-break>
          <div className="flex items-center justify-between px-4">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#D3D9B5] text-white rounded-xl flex items-center justify-center shadow-sm">
                   <i className="fa-solid fa-hammer"></i>
                </div>
                <div>
                   <h2 className="text-xl sm:text-2xl font-bold text-[#4A4137] tracking-tight">Uplift & Value-Add Strategies</h2>
                   <p className="text-[11px] sm:text-[10px] font-bold text-[#D3D9B5] uppercase tracking-widest mt-0.5">Renovation & Potential Development</p>
                </div>
             </div>
             {selectedStrategies.size > 0 && (
                <button onClick={() => setSelectedStrategies(new Set())} data-no-pdf="true" className="text-[10px] font-black uppercase tracking-widest text-[#4A4137]/40 hover:text-[#D6A270] transition-colors">Reset Selections</button>
             )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-pdf-strategy-grid>
             {data.valueAddStrategies.map((strategy, i) => (
               <div key={i} data-pdf-strategy-card data-pdf-no-break className={`p-8 rounded-[2.5rem] border shadow-sm transition-all group border-b-4 flex flex-col ${selectedStrategies.has(i) ? 'border-[#D3D9B5] shadow-md ring-1 ring-[#D3D9B5]/20' : 'border-b-[#D6A270]/20 hover:shadow-md'}`} style={{ backgroundColor: 'var(--bg-card)', borderColor: selectedStrategies.has(i) ? '#D3D9B5' : 'var(--border-color)' }}>
                  <div className="flex justify-between items-start mb-4">
                     <div className="space-y-1">
                        <h3 className="text-base sm:text-lg font-bold text-[#4A4137] group-hover:text-[#D6A270] transition-colors">{strategy.title}</h3>
                        <PathwayBadgeWithTooltip pathway={strategy.planningPathway} />
                     </div>
                     <div className="flex flex-col items-end gap-2">
                        <button onClick={() => toggleStrategy(i)} data-no-pdf="true" className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${selectedStrategies.has(i) ? 'bg-[#D3D9B5] text-white border-[#D3D9B5]' : 'bg-white text-[#4A4137]/40 border-slate-200 hover:border-[#D3D9B5] hover:text-[#D3D9B5]'}`}>{selectedStrategies.has(i) ? <><i className="fa-solid fa-check mr-1"></i> Included</> : 'Include'}</button>
                        <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getEffortColor(strategy.effort)}`}>{strategy.effort} Effort</div>
                     </div>
                  </div>
                  <p className="text-sm text-[#4A4137]/60 leading-relaxed mb-6">{strategy.description}</p>
                  <div className="grid grid-cols-2 gap-3 mb-2 mt-auto">
                     <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
                        <p className="text-[8px] font-black text-[#4A4137]/50 uppercase tracking-widest mb-1">Estimated Cost</p>
                        <p className="text-sm font-bold text-[#4A4137]">{formatValue(strategy.estimatedCost?.low)} – {formatValue(strategy.estimatedCost?.high)}</p>
                     </div>
                     {(strategy.indicativeEquityUplift || strategy.saleProfitEstimate) && (
                       <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col justify-center">
                          <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Equity Gain $</p>
                          <p className="text-sm font-black text-emerald-700">{strategy.indicativeEquityUplift ? `${formatValue(strategy.indicativeEquityUplift.low)} – ${formatValue(strategy.indicativeEquityUplift.high)}` : `${formatValue(strategy.saleProfitEstimate?.low)} – ${formatValue(strategy.saleProfitEstimate?.high)}`}</p>
                       </div>
                     )}
                  </div>
               </div>
             ))}
          </div>
        </section>
      )}

      {/* INDICATIVE POST-RENOVATION RENTAL POSITION */}
      <section className="space-y-6 pdf-no-break">
        <div className="flex items-center gap-4 px-4">
          <div className="w-10 h-10 bg-[#C9A961] text-white rounded-xl flex items-center justify-center shadow-md">
            <i className="fa-solid fa-key"></i>
          </div>
          <div>
            <h2 id="rental-position" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Indicative Post-Renovation Rental Position</h2>
            <p className="text-[11px] sm:text-[10px] font-bold text-[#C9A961] uppercase tracking-widest mt-0.5">Yield & Cash Flow (After Improvements)</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 rounded-[2.5rem] border shadow-sm flex flex-col justify-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <p className="text-[11px] sm:text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Indicative Weekly Rent</p>
            <p className="text-xl sm:text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
              {data.rentalPosition?.estimatedWeeklyRent ? `$${data.rentalPosition.estimatedWeeklyRent} / wk` : 'Indicative only'}
            </p>
          </div>
          <div className="p-8 rounded-[2.5rem] border shadow-sm flex flex-col justify-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <p className="text-[11px] sm:text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Indicative Annual Rent</p>
            <p className="text-xl sm:text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
              {data.rentalPosition?.estimatedWeeklyRent ? formatValue(data.rentalPosition.estimatedWeeklyRent * 52) : 'Indicative only'}
            </p>
          </div>
          <div className="p-10 rounded-[3rem] border shadow-sm relative group" style={{ backgroundColor: 'var(--accent-gold-light)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[9px] font-black text-[#3A342D] uppercase tracking-[0.1em] max-w-[180px]">INDICATIVE WEEKLY CASH POSITION</p>
              <div className="w-6 h-6 rounded-full bg-slate-200/50 flex items-center justify-center cursor-help">
                <i className="fa-solid fa-info text-[9px] text-[#3A342D]"></i>
              </div>
            </div>
            <div className="space-y-1">
              <p className={`text-xl sm:text-2xl md:text-3xl font-black ${cashColorClass} tracking-tight leading-none`}>
                {cashPos !== undefined 
                  ? `${isNegative ? '' : isPositive ? '+' : ''}${formatValue(cashPos)} / wk`
                  : 'TBA'}
              </p>
            </div>
            {/* Tooltip Content */}
            <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-[#3A342D] text-white text-[11px] font-medium rounded-2xl shadow-2xl z-50 transition-all opacity-0 group-hover:opacity-100 pointer-events-none leading-relaxed text-center">
              Estimated weekly surplus or gap after principal and interest repayments.
              <br/><br/>
              <span className="opacity-60 italic text-[10px]">Assumes 80% LVR investment loan at current rates (~6.3%) over 30 years. {data.rentalPosition?.repaymentAssumptionNotes}</span>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#3A342D]"></div>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-[#3A342D]/30 italic px-4 leading-relaxed">
          <strong>Assumptions:</strong> 80% LVR, 6.3% interest (P&I), 30yr term. Excludes stamp duty, fees, vacancy, rates, insurance & strata. Indicative only—verify with your lender.
        </p>
      </section>

      {/* DEVELOPMENT SCENARIOS */}
      {data.developmentScenarios && data.developmentScenarios.length > 0 && (
        <section className="space-y-6 pdf-no-break" data-pdf-page-break>
           <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-[#4A4137] text-white rounded-xl flex items-center justify-center shadow-sm"><i className="fa-solid fa-city"></i></div>
                 <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#4A4137] tracking-tight">Development Scenarios</h2>
                    <p className="text-[11px] sm:text-[10px] font-bold text-[#4A4137]/40 uppercase tracking-widest mt-0.5">Indicative Feasibility Analysis</p>
                 </div>
              </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.developmentScenarios.map((scenario, i) => (
                <div key={i} className="p-6 rounded-[2.5rem] border shadow-sm transition-all group border-b-4 flex flex-col hover:shadow-md" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                   <div className="flex justify-between items-start mb-3">
                      <div className="space-y-1">
                         <h3 className="text-base font-bold text-[#4A4137]">{scenario.title}</h3>
                         <div className="flex flex-wrap gap-2">
                            <PathwayBadgeWithTooltip pathway={scenario.planningPathway} />
                         </div>
                      </div>
                   </div>
                   <p className="text-sm text-[#4A4137]/60 leading-relaxed mb-3">{scenario.description}</p>
                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                      <p className="text-[9px] font-bold text-[#4A4137]/50 uppercase tracking-widest mb-1">Assessment Notes</p>
                      <p className="text-xs text-[#4A4137]/70 italic leading-relaxed">{scenario.whyAllowedOrNot}</p>
                   </div>
                   <div className="grid grid-cols-1 gap-3 mb-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                         <p className="text-[9px] font-black text-[#4A4137]/50 uppercase tracking-widest mb-1">Est. Build Cost</p>
                         <p className="text-base font-bold text-[#4A4137]">{formatValue(scenario.estimatedCost?.low)} – {formatValue(scenario.estimatedCost?.high)}</p>
                      </div>
                   </div>
                   {scenario.estimatedNetProfit && (() => {
                     // Determine if overall outlook is positive or negative
                     const low = scenario.estimatedNetProfit.low || 0;
                     const high = scenario.estimatedNetProfit.high || 0;
                     const isOverallNegative = (low + high) < 0;
                     
                     // Color logic: dominant sentiment gets theme color, opposite gets cream
                     // RED container: negative=red, positive=cream
                     // GREEN container: positive=green, negative=cream
                     const getLowColor = () => {
                       if (low < 0) return isOverallNegative ? 'text-red-700' : 'text-amber-700'; // negative value
                       return isOverallNegative ? 'text-amber-700' : 'text-emerald-700'; // positive value
                     };
                     const getHighColor = () => {
                       if (high < 0) return isOverallNegative ? 'text-red-700' : 'text-amber-700'; // negative value
                       return isOverallNegative ? 'text-amber-700' : 'text-emerald-700'; // positive value
                     };
                     
                     return (
                       <div className={`p-4 rounded-xl border mt-auto ${
                         isOverallNegative 
                           ? 'bg-red-50 border-red-100' 
                           : 'bg-emerald-50 border-emerald-100'
                       }`}>
                          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 text-center ${
                            isOverallNegative ? 'text-red-600' : 'text-emerald-600'
                          }`}>INDICATIVE MARGIN</p>
                          <p className="text-xl font-black text-center">
                            <span className={getLowColor()}>{formatValue(scenario.estimatedNetProfit.low)}</span>
                            <span className="text-[#4A4137]/40"> – </span>
                            <span className={getHighColor()}>{formatValue(scenario.estimatedNetProfit.high)}</span>
                          </p>
                       </div>
                     );
                   })()}
                </div>
              ))}
           </div>
           <p className="text-[9px] text-[#4A4137]/30 italic px-4 leading-relaxed">
             Scenarios are indicative only. Minimum lot sizes, setbacks, and controls vary by council LEP/DCP. Requires site-specific feasibility assessment.
           </p>
        </section>
      )}

      {/* APPROVAL PATHWAY & ZONING INTEL - Only render if at least one has content */}
      {(data.approvalPathway || data.zoningIntel) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 pdf-no-break" data-pdf-page-break>
          {data.approvalPathway && data.approvalPathway.likelyPathway && (
            <div className="p-10 rounded-[3rem] border shadow-sm space-y-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-md"><i className="fa-solid fa-file-shield"></i></div>
                  <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Likely Approval Pathway</h2>
               </div>
               <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="mb-4"><PathwayBadgeWithTooltip pathway={data.approvalPathway.likelyPathway} /></div>
                  <p className="text-sm text-[#4A4137]/60 leading-relaxed">{replaceStateTerminology(data.approvalPathway.explanation, propertyState)}</p>
               </div>
               <p className="text-[9px] text-[#4A4137]/40 italic leading-relaxed">
                  Indicative pathway only. Actual requirements depend on site-specific factors. Consult a town planner or your local council.
               </p>
            </div>
          )}
          {data.zoningIntel && data.zoningIntel.currentZoneCode && (
            <div className="bg-[#D3D9B5]/10 p-10 rounded-[3rem] border border-[#D3D9B5]/20 space-y-6">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#D3D9B5] text-white rounded-xl flex items-center justify-center shadow-md"><i className="fa-solid fa-map-location-dot"></i></div>
                  <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Zoning Summary</h2>
               </div>
               <div className="px-6 py-4 bg-white rounded-3xl border border-[#D3D9B5]/20 text-center space-y-2 shadow-sm">
                  <p className="text-[10px] font-black text-[#4A4137]/40 uppercase tracking-widest">Zone Code</p>
                  <p className="text-2xl font-black text-[#4A4137] tracking-widest">{data.zoningIntel.currentZoneCode || '—'}</p>
                  <p className="text-xs font-bold text-[#D3D9B5] uppercase">{data.zoningIntel.currentZoneTitle || '—'}</p>
               </div>
               <p className="text-sm text-[#4A4137]/70 font-medium leading-relaxed">{data.zoningIntel.whatItMeans}</p>
               <p className="text-[9px] text-[#4A4137]/40 italic leading-relaxed">
                  Verify current zoning and controls via the local LEP/DCP or council planning portal.
               </p>
            </div>
          )}
        </section>
      )}

      {/* COMPARABLE SALES - Only sold properties, filtered for validity */}
      {(() => {
        const filteredSales = filterSoldComparables(data.comparableSales?.nearbySales);
        const fallbackMessage = getComparablesFallbackMessage(filteredSales.length);
        
        return (data.comparableSales && (filteredSales.length > 0 || fallbackMessage)) && (
          <section className="space-y-6 pdf-no-break">
             <div className="flex items-center gap-4 px-4">
                <div className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-sm"><i className="fa-solid fa-tags"></i></div>
                <div>
                  <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Comparable Market Sales</h2>
                  <p className="text-[10px] text-[#4A4137]/40 uppercase tracking-widest">Recently sold within 2km (18 months)</p>
                </div>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-pdf-sales-grid>
                <div className="lg:col-span-2 space-y-4">
                   {filteredSales.length > 0 ? (
                     <div className="p-6 rounded-[2.5rem] border shadow-sm space-y-3" data-pdf-no-break style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                        {filteredSales.map((sale, i) => (
                           <div key={i} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100 group transition-all hover:border-[#D6A270]/20">
                              <div className="flex gap-3 items-center flex-1 min-w-0">
                                 <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-[9px] font-bold text-[#4A4137]/40 shadow-sm flex-shrink-0">
                                   {sale.distanceKm ? `${sale.distanceKm}km` : '–'}
                                 </div>
                                 <div className="space-y-0.5 min-w-0 flex-1">
                                    <p className="text-sm font-bold text-[#4A4137] truncate">{sale.addressShort || '—'}</p>
                                    <div className="flex items-center gap-2 text-[9px] text-[#4A4137]/40">
                                      <span className="font-semibold text-emerald-600">Sold {sale.date || '—'}</span>
                                      {sale.beds && <span>• {sale.beds}bd</span>}
                                      {sale.baths && <span>{sale.baths}ba</span>}
                                    </div>
                                 </div>
                              </div>
                              <p className="text-sm font-black text-[#D6A270] flex-shrink-0 ml-2">{formatValue(sale.price)}</p>
                           </div>
                        ))}
                     </div>
                   ) : (
                     <div className="p-6 rounded-[2.5rem] border shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                        <p className="text-sm text-[#4A4137]/60 italic">{fallbackMessage}</p>
                     </div>
                   )}
                   <p className="text-[9px] text-[#4A4137]/30 italic px-2">
                     Sales shown are verified sold comparables only. Actual property condition, features, and timing affect relevance.
                   </p>
                </div>
                {data.comparableSales.pricingContextSummary && (
                  <div className="bg-[#4A4137] p-6 rounded-[2.5rem] text-white space-y-4 relative overflow-hidden h-fit" data-pdf-no-break>
                     <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Market Context</p>
                     <p className="text-sm font-medium leading-relaxed text-white/80">{data.comparableSales.pricingContextSummary}</p>
                  </div>
                )}
             </div>
          </section>
        );
      })()}

      {/* WATCH OUTS */}
      {data.watchOuts && data.watchOuts.length > 0 && (
        <section data-pdf-watchouts data-pdf-no-break className="bg-rose-50/50 p-10 md:p-14 rounded-[4rem] border border-rose-100 space-y-8 pdf-no-break">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-200"><i className="fa-solid fa-eye"></i></div>
             <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Things to Watch Out For</h2>
          </div>
          <div className="grid grid-cols-1 gap-6">
             {data.watchOuts.map((wo, i) => (
               <div key={i} className="bg-white p-8 rounded-[2.5rem] flex flex-col md:flex-row gap-6 border border-rose-100 shadow-sm group">
                  <div className="flex-shrink-0 mt-1 text-2xl">{getSeverityIcon(wo.severity)}</div>
                  <div className="space-y-3 flex-grow">
                     <h3 className="text-lg font-bold text-[#4A4137]">{wo.title}</h3>
                     <p className="text-sm text-[#4A4137]/60 leading-relaxed">{wo.description}</p>
                  </div>
               </div>
             ))}
          </div>
        </section>
      )}

      {/* SEARCH ANOTHER PROPERTY BUTTON - Hidden in PDF */}
      <div className="flex justify-center pt-8" data-no-pdf="true">
         <button 
           onClick={onHome}
           className="px-12 py-5 bg-[#3A342D] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl hover:bg-[#C9A961] transition-all transform active:scale-95 flex items-center gap-3"
         >
           <i className="fa-solid fa-magnifying-glass"></i>
           Search Another Property
         </button>
      </div>

      <footer className="pt-10 pb-6" data-no-pdf="true">
        <div className="text-center">
          <p className="text-[10px] sm:text-[11px] leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--text-muted)' }}>
            upblock.ai provides AI-assisted, scenario-based property insights using publicly available data. It does not constitute financial advice, a property valuation, or planning approval.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PropertyResults;