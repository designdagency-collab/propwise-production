import React, { useState, useRef } from 'react';
import { PropertyData, PlanType, DevEligibility, Amenity } from '../types';

interface PropertyResultsProps {
  data: PropertyData;
  address: string;
  plan: PlanType;
  onUpgrade: () => void;
  onHome: () => void;
}

const PropertyResults: React.FC<PropertyResultsProps> = ({ data, plan, onUpgrade, onHome }) => {
  const [selectedStrategies, setSelectedStrategies] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const getPathwayBadgeColor = (pathway: string) => {
    if (isStrata && pathway === 'Exempt') return 'bg-indigo-600 text-white';
    switch (pathway) {
      case 'Exempt': return 'bg-emerald-500 text-white';
      case 'CDC': return 'bg-blue-500 text-white';
      case 'DA': return 'bg-amber-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getPathwayDescription = (pathway: string) => {
    if (isStrata && pathway === 'Exempt') {
      return "Strata Permission: Works are exempt from local council approval but require formal permission from the Owners Corporation / Body Corporate.";
    }
    switch (pathway) {
      case 'Exempt': return "Exempt Development: Minor works that don't require formal planning or building approval from council.";
      case 'CDC': return "Complying Development Certificate: Fast-track approval process for projects meeting pre-set standards.";
      case 'DA': return "Development Application: Merits-based council assessment for custom or complex projects.";
      default: return "Specific approval requirements vary by local council and project scope.";
    }
  };

  const PathwayBadgeWithTooltip = ({ pathway }: { pathway: string }) => {
    const displayText = (isStrata && pathway === 'Exempt') ? 'Strata Permission' : pathway;
    return (
      <div className="group relative inline-block">
        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest cursor-help transition-opacity hover:opacity-90 ${getPathwayBadgeColor(pathway)}`}>
          {displayText}
        </span>
        <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#4A4137] text-white text-[9px] font-medium rounded-lg shadow-xl z-50 transition-all opacity-0 group-hover:opacity-100 pointer-events-none leading-relaxed text-center">
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
   * PDF Export Styles - ULTRA COMPACT for premium output
   */
  const getPdfStyles = () => `
    /* Base PDF Reset */
    .pdf-mode {
      background-color: #ffffff !important;
      color: #3A342D !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
      font-size: 10px !important;
      line-height: 1.35 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .pdf-mode * {
      transition: none !important;
      animation: none !important;
      box-sizing: border-box !important;
    }
    
    /* Hide non-PDF elements */
    .pdf-mode [data-no-pdf="true"],
    .pdf-mode button:not([data-pdf-keep]),
    .pdf-mode .invisible,
    .pdf-mode [class*="group-hover"] { 
      display: none !important; 
    }
    
    /* Container - ULTRA TIGHT */
    .pdf-mode [data-pdf-root="true"] {
      max-width: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .pdf-mode .space-y-12 > * + * { margin-top: 10px !important; }
    .pdf-mode .space-y-8 > * + * { margin-top: 8px !important; }
    .pdf-mode .space-y-6 > * + * { margin-top: 6px !important; }
    .pdf-mode .space-y-4 > * + * { margin-top: 4px !important; }
    .pdf-mode .space-y-3 > * + * { margin-top: 3px !important; }
    .pdf-mode .space-y-2 > * + * { margin-top: 2px !important; }
    
    /* Cards - COMPACT padding, NO SHADOWS */
    .pdf-mode [class*="rounded-[2"],
    .pdf-mode [class*="rounded-[3"],
    .pdf-mode [class*="rounded-[4"] {
      border-radius: 10px !important;
      border: 1px solid rgba(201, 169, 97, 0.2) !important;
      background-color: #ffffff !important;
      padding: 10px !important;
      margin-bottom: 6px !important;
      overflow: visible !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      box-shadow: none !important;
    }
    /* Remove ALL shadows in PDF */
    .pdf-mode * {
      box-shadow: none !important;
      -webkit-box-shadow: none !important;
    }
    .pdf-mode [class*="shadow"] {
      box-shadow: none !important;
    }
    .pdf-mode .p-4, .pdf-mode .p-5, .pdf-mode .p-6, .pdf-mode .p-8, .pdf-mode .p-10, .pdf-mode .p-12 {
      padding: 10px !important;
    }
    .pdf-mode .md\\:p-8, .pdf-mode .md\\:p-10, .pdf-mode .md\\:p-12, .pdf-mode .md\\:p-14 {
      padding: 12px !important;
    }
    .pdf-mode .py-3, .pdf-mode .py-4, .pdf-mode .py-5, .pdf-mode .py-6 {
      padding-top: 6px !important;
      padding-bottom: 6px !important;
    }
    .pdf-mode .px-4, .pdf-mode .px-5, .pdf-mode .px-6 {
      padding-left: 8px !important;
      padding-right: 8px !important;
    }
    .pdf-mode .mb-3, .pdf-mode .mb-4, .pdf-mode .mb-5, .pdf-mode .mb-6, .pdf-mode .mb-8 {
      margin-bottom: 4px !important;
    }
    .pdf-mode .mt-3, .pdf-mode .mt-4, .pdf-mode .mt-5, .pdf-mode .mt-6, .pdf-mode .mt-8 {
      margin-top: 4px !important;
    }
    
    /* KPI Row - Grid Layout COMPACT */
    .pdf-mode [data-pdf-kpi-row] {
      display: grid !important;
      grid-template-columns: repeat(4, 1fr) !important;
      gap: 8px !important;
      padding-top: 8px !important;
      margin-top: 8px !important;
    }
    .pdf-mode [data-pdf-kpi] {
      min-width: 0 !important;
    }
    .pdf-mode [data-pdf-kpi] p:first-child {
      font-size: 7px !important;
      color: #777 !important;
      margin-bottom: 1px !important;
      text-transform: uppercase !important;
      letter-spacing: 0.4px !important;
    }
    .pdf-mode [data-pdf-kpi] p:last-child {
      font-size: 13px !important;
      font-weight: 800 !important;
      font-variant-numeric: tabular-nums !important;
    }
    
    /* Typography - COMPACT */
    .pdf-mode h1 { font-size: 20px !important; line-height: 1.1 !important; color: #3A342D !important; margin-bottom: 2px !important; }
    .pdf-mode h2 { font-size: 13px !important; line-height: 1.15 !important; color: #3A342D !important; margin-bottom: 4px !important; }
    .pdf-mode h3 { font-size: 11px !important; line-height: 1.2 !important; color: #3A342D !important; margin-bottom: 2px !important; }
    .pdf-mode p { font-size: 9px !important; line-height: 1.35 !important; margin: 0 !important; }
    
    /* Section spacing - COMPACT */
    .pdf-mode section { margin-bottom: 8px !important; break-inside: avoid !important; }
    .pdf-mode .gap-2 { gap: 4px !important; }
    .pdf-mode .gap-3 { gap: 5px !important; }
    .pdf-mode .gap-4 { gap: 6px !important; }
    .pdf-mode .gap-5, .pdf-mode .gap-6 { gap: 6px !important; }
    .pdf-mode .gap-8 { gap: 8px !important; }
    
    /* Strategy Grid - COMPACT */
    .pdf-mode [data-pdf-strategy-grid] {
      display: grid !important;
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 6px !important;
    }
    .pdf-mode [data-pdf-strategy-card] {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      padding: 8px !important;
    }
    
    /* BADGES - COMPACT */
    .pdf-mode span[class*="rounded"] {
      display: inline-block !important;
      white-space: nowrap !important;
      overflow: visible !important;
      text-overflow: clip !important;
      padding: 2px 6px !important;
      font-size: 7px !important;
      font-weight: 700 !important;
      letter-spacing: 0.4px !important;
      line-height: 1.2 !important;
    }
    .pdf-mode .text-\\[8px\\], .pdf-mode .text-\\[9px\\], .pdf-mode .text-\\[10px\\] {
      font-size: 7px !important;
      white-space: nowrap !important;
      overflow: visible !important;
    }
    .pdf-mode .tracking-widest, .pdf-mode .tracking-wider {
      letter-spacing: 0.2px !important;
    }
    
    /* Callout Banner - COMPACT with smaller icon, bigger text */
    .pdf-mode [data-pdf-callout] {
      background-color: #4A4137 !important;
      color: #ffffff !important;
      border-radius: 10px !important;
      padding: 14px !important;
      break-inside: avoid !important;
      margin-bottom: 8px !important;
    }
    .pdf-mode [data-pdf-callout] * { color: inherit !important; }
    .pdf-mode [data-pdf-callout] .text-\\[\\#D6A270\\] { color: #D6A270 !important; }
    .pdf-mode [data-pdf-callout] h3 { font-size: 16px !important; margin-bottom: 3px !important; font-weight: 700 !important; }
    .pdf-mode [data-pdf-callout] p { font-size: 11px !important; line-height: 1.4 !important; }
    .pdf-mode [data-pdf-callout] .text-\\[8px\\], .pdf-mode [data-pdf-callout] .text-\\[9px\\] { font-size: 9px !important; }
    /* Callout icon - SMALLER */
    .pdf-mode [data-pdf-callout] .w-16, .pdf-mode [data-pdf-callout] .w-20 { width: 40px !important; }
    .pdf-mode [data-pdf-callout] .h-16, .pdf-mode [data-pdf-callout] .h-20 { height: 40px !important; }
    .pdf-mode [data-pdf-callout] [class*="rounded-[2"] { width: 40px !important; height: 40px !important; padding: 8px !important; }
    .pdf-mode [data-pdf-callout] i.fa-sack-dollar { font-size: 18px !important; }
    
    /* Map Container - BIGGER */
    .pdf-mode [data-map="true"] {
      height: 220px !important;
      border-radius: 10px !important;
      overflow: hidden !important;
      break-inside: avoid !important;
      margin-bottom: 8px !important;
    }
    .pdf-mode .pdf-map-image {
      width: 100% !important;
      height: 220px !important;
      object-fit: cover !important;
      display: block !important;
      border-radius: 10px !important;
    }
    .pdf-mode .pdf-map-placeholder {
      width: 100% !important;
      height: 220px !important;
      background: linear-gradient(135deg, #f3f4f6, #e5e7eb) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 10px !important;
      color: #6b7280 !important;
      font-size: 11px !important;
    }
    
    /* Amenity Cards - SMALLER & COMPACT */
    .pdf-mode [data-pdf-amenities] {
      gap: 4px !important;
    }
    .pdf-mode [data-pdf-amenities] > div {
      padding: 6px 8px !important;
      border-radius: 8px !important;
    }
    .pdf-mode [data-pdf-amenities] p:first-child {
      font-size: 6px !important;
      margin-bottom: 1px !important;
    }
    .pdf-mode [data-pdf-amenities] p:nth-child(2) {
      font-size: 9px !important;
      font-weight: 600 !important;
      margin-bottom: 0 !important;
    }
    .pdf-mode [data-pdf-amenities] p:last-child {
      font-size: 8px !important;
    }
    
    /* Watch Outs - COMPACT */
    .pdf-mode [data-pdf-watchouts] {
      background-color: #fff5f5 !important;
      border: 1px solid #fecaca !important;
      padding: 10px !important;
    }
    
    /* Badge Colors - ensure visibility */
    .pdf-mode .bg-emerald-500 { background-color: #10b981 !important; color: white !important; }
    .pdf-mode .bg-blue-500 { background-color: #3b82f6 !important; color: white !important; }
    .pdf-mode .bg-amber-500 { background-color: #f59e0b !important; color: white !important; }
    .pdf-mode .bg-rose-500 { background-color: #f43f5e !important; color: white !important; }
    .pdf-mode .bg-indigo-600 { background-color: #4f46e5 !important; color: white !important; }
    .pdf-mode .bg-slate-500 { background-color: #64748b !important; color: white !important; }
    
    /* Text colors */
    .pdf-mode .text-emerald-600, .pdf-mode .text-emerald-700 { color: #059669 !important; }
    .pdf-mode .text-\\[\\#B8864A\\] { color: #B8864A !important; }
    .pdf-mode .text-\\[\\#8A9A6D\\] { color: #8A9A6D !important; }
    .pdf-mode .text-\\[\\#D6A270\\] { color: #D6A270 !important; }
    .pdf-mode .text-\\[\\#4A4137\\] { color: #3A342D !important; }
    .pdf-mode .text-\\[\\#3A342D\\] { color: #3A342D !important; }
    
    /* Slate backgrounds for nested cards */
    .pdf-mode .bg-slate-50 { background-color: #f8fafc !important; }
    .pdf-mode .bg-slate-50\\/50 { background-color: #fafbfc !important; }
    .pdf-mode .bg-emerald-50 { background-color: #ecfdf5 !important; }
    .pdf-mode .bg-amber-50 { background-color: #fffbeb !important; }
    
    /* Grid layouts - COMPACT gaps */
    .pdf-mode .grid-cols-1.md\\:grid-cols-2 { 
      display: grid !important; 
      grid-template-columns: repeat(2, 1fr) !important; 
      gap: 6px !important; 
    }
    .pdf-mode .grid-cols-1.md\\:grid-cols-3 { 
      display: grid !important; 
      grid-template-columns: repeat(3, 1fr) !important; 
      gap: 6px !important; 
    }
    .pdf-mode .grid-cols-1.lg\\:grid-cols-3 { 
      display: grid !important; 
      grid-template-columns: 2fr 1fr !important; 
      gap: 6px !important; 
    }
    .pdf-mode .grid-cols-1.lg\\:grid-cols-4 { 
      display: grid !important; 
      grid-template-columns: repeat(2, 1fr) !important; 
      gap: 6px !important; 
    }
    
    /* Decorative - Hide */
    .pdf-mode [class*="blur-"], .pdf-mode [class*="-mr-32"], .pdf-mode [class*="-mt-32"] { display: none !important; }
    .pdf-mode .absolute { position: relative !important; }
    
    /* Border spacing */
    .pdf-mode .border-t { border-top-width: 1px !important; padding-top: 6px !important; margin-top: 6px !important; }
    .pdf-mode .border-b { border-bottom-width: 1px !important; padding-bottom: 6px !important; margin-bottom: 6px !important; }
    
    /* Footer - COMPACT */
    .pdf-mode footer { margin-top: 10px !important; padding-top: 8px !important; border-top: 1px solid #eee !important; }
    .pdf-mode footer p { font-size: 7px !important; color: #999 !important; }
    
    /* Fix icon sizing */
    .pdf-mode .w-10.h-10 { width: 24px !important; height: 24px !important; }
    .pdf-mode .w-8.h-8 { width: 20px !important; height: 20px !important; }
    .pdf-mode .w-6.h-6 { width: 16px !important; height: 16px !important; }
    .pdf-mode i { font-size: inherit !important; }
    
    /* Tables - COMPACT */
    .pdf-mode table { margin: 4px 0 !important; }
    .pdf-mode th, .pdf-mode td { padding: 4px 6px !important; font-size: 9px !important; }
    
    /* PRICES - BIGGER fonts for costs/values */
    .pdf-mode .text-2xl, .pdf-mode .text-3xl, .pdf-mode .text-4xl {
      font-size: 18px !important;
      font-weight: 800 !important;
    }
    .pdf-mode .text-xl {
      font-size: 16px !important;
      font-weight: 700 !important;
    }
    .pdf-mode .text-lg {
      font-size: 14px !important;
      font-weight: 700 !important;
    }
    /* Estimated cost labels */
    .pdf-mode [class*="ESTIMATED"], .pdf-mode p:contains("ESTIMATED") {
      font-size: 8px !important;
    }
    /* Price values - make them stand out */
    .pdf-mode .font-black, .pdf-mode .font-extrabold, .pdf-mode .font-bold {
      font-weight: 800 !important;
    }
    /* Strategy card costs */
    .pdf-mode [data-pdf-strategy-card] .text-emerald-700,
    .pdf-mode [data-pdf-strategy-card] .text-\\[\\#8A9A6D\\] {
      font-size: 16px !important;
      font-weight: 800 !important;
    }
    /* Development scenario costs/margins */
    .pdf-mode .text-emerald-600 {
      font-size: 14px !important;
      font-weight: 700 !important;
    }
    /* KPI values - bigger */
    .pdf-mode [data-pdf-kpi] p:last-child {
      font-size: 16px !important;
      font-weight: 800 !important;
    }
    /* Callout profit numbers */
    .pdf-mode [data-pdf-callout] .text-\\[\\#D6A270\\] {
      font-size: 20px !important;
      font-weight: 800 !important;
    }
  `;

  /**
   * Export report to PDF using server-side Puppeteer
   * 
   * Key features:
   * - Server-side rendering with headless Chrome for pixel-perfect output
   * - Consistent results across all browsers
   * - Professional quality suitable for premium users
   */
  const exportToPDF = async () => {
    if (!reportRef.current || !isPaidUser) return;
    
    setIsExporting(true);
    
    try {
      // 1. Pre-fetch static map image
      let mapDataUrl: string | null = null;
      try {
        const staticMapUrl = `/api/static-map?address=${encodeURIComponent(data.address)}&width=800&height=400&zoom=17`;
        const mapResponse = await fetch(staticMapUrl);
        
        if (mapResponse.ok && mapResponse.headers.get('content-type')?.includes('image')) {
          const blob = await mapResponse.blob();
          mapDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (mapError) {
        console.warn('Could not pre-fetch static map:', mapError);
      }

      // 2. Clone and prepare HTML for PDF
      const element = reportRef.current;
      const clonedElement = element.cloneNode(true) as HTMLElement;
      
      // Remove elements not needed in PDF
      const noPdfElements = clonedElement.querySelectorAll('[data-no-pdf="true"]');
      noPdfElements.forEach(el => el.remove());
      
      const buttons = clonedElement.querySelectorAll('button:not([data-pdf-keep])');
      buttons.forEach(btn => btn.remove());
      
      const tooltips = clonedElement.querySelectorAll('.invisible, [class*="group-hover"]:not([data-pdf-keep])');
      tooltips.forEach(el => el.remove());
      
      // Replace map with static image
      const mapContainers = clonedElement.querySelectorAll('[data-map="true"]');
      mapContainers.forEach(container => {
        const mapEl = container as HTMLElement;
        mapEl.innerHTML = '';
        
        if (mapDataUrl) {
          const img = document.createElement('img');
          img.src = mapDataUrl;
          img.alt = `Map of ${data.address}`;
          img.style.cssText = 'width: 100%; height: auto; border-radius: 12px;';
          mapEl.appendChild(img);
        } else {
          const placeholder = document.createElement('div');
          placeholder.style.cssText = 'padding: 40px; text-align: center; background: #f5f5f5; border-radius: 12px;';
          placeholder.innerHTML = `<span>📍 ${data.address}</span>`;
          mapEl.appendChild(placeholder);
        }
      });
      
      // Remove animations and blur elements
      const blurElements = clonedElement.querySelectorAll('[class*="blur-3xl"], [class*="blur-2xl"]');
      blurElements.forEach(el => el.remove());

      // 3. Build complete HTML document for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              background: #ffffff;
              color: #3A342D;
              margin: 0;
              padding: 10px;
              line-height: 1.5;
            }
            ${getPdfStyles()}
            
            /* Additional print optimizations */
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            
            /* Ensure proper page breaks */
            section { break-inside: avoid; page-break-inside: avoid; }
            .grid { break-inside: avoid; }
            
            /* Fix table layouts */
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
            
            /* Ensure colors render */
            .bg-\\[\\#C9A961\\] { background-color: #C9A961 !important; }
            .text-\\[\\#C9A961\\] { color: #C9A961 !important; }
            .text-\\[\\#D6A270\\] { color: #D6A270 !important; }
            .bg-\\[\\#D6A270\\] { background-color: #D6A270 !important; }
          </style>
        </head>
        <body class="pdf-mode">
          ${clonedElement.outerHTML}
          <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 10px; color: #888;">
            upblock.ai provides AI-assisted, scenario-based property insights using publicly available data.<br>
            It does not constitute financial advice, a property valuation, or planning approval.
          </footer>
        </body>
        </html>
      `;

      const filename = `upblock-${data.address.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;

      // 4. Generate PDF via Puppeteer API (premium server-side rendering)
      console.log('[PDF] Sending to Puppeteer API...');
      
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlContent, filename })
      });

      // Check for errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.details || errorData.error || 'PDF generation failed');
      }

      // Verify we got a PDF
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
                  disabled={isExporting}
                  data-no-pdf="true"
                  className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:text-[#D6A270] transition-colors flex items-center gap-1 disabled:opacity-50" 
                  style={{ color: 'var(--text-muted)' }}
                >
                  <i className={`fa-solid ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
                  {isExporting ? 'Exporting...' : 'Export PDF'}
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
            <p className="font-medium text-sm sm:text-base mt-2" style={{ color: 'var(--text-muted)' }}>{data.propertyType} • {data.landSize || 'Unknown Land Size'}</p>
          </div>
          <div className="flex flex-wrap gap-8 pt-8 border-t" style={{ borderColor: 'var(--border-color)' }} data-pdf-kpi-row>
             <div className="space-y-1" data-pdf-kpi>
                <p className="text-[11px] sm:text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Estimated Market Value</p>
                <p className="text-xl sm:text-2xl font-black text-[#B8864A]">{formatValue(data?.valueSnapshot?.indicativeMidpoint)}</p>
             </div>
             <div className="space-y-1" data-pdf-kpi>
                <p className="text-[11px] sm:text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Potential Value After Improvements</p>
                <p className={`text-xl sm:text-2xl font-black transition-colors ${effectiveSelection.size > 0 ? 'text-[#8A9A6D]' : ''}`} style={{ color: effectiveSelection.size > 0 ? '#8A9A6D' : 'var(--text-primary)' }}>
                   {baseline === undefined ? 'TBA' : effectiveSelection.size === 0 ? formatValue(baseline) : `${formatValue(afterLow)} – ${formatValue(afterHigh)}`}
                </p>
             </div>
             <div className="space-y-1" data-pdf-kpi>
                <p className="text-[11px] sm:text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Growth Trend</p>
                <p className="text-xl sm:text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{data?.valueSnapshot?.growth || 'TBA'}</p>
             </div>
             <div className="space-y-1" data-pdf-kpi>
                <p className="text-[11px] sm:text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Data Confidence</p>
                <p className="text-xl sm:text-2xl font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                   {data?.valueSnapshot?.confidenceLevel || 'Low'}
                   <i className={`fa-solid fa-circle-check text-xs ${data?.valueSnapshot?.confidenceLevel === 'High' ? 'text-emerald-500' : 'text-amber-500'}`}></i>
                </p>
             </div>
          </div>
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
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Indicative Post-Renovation Rental Position</h2>
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
          Indicative weekly figures based on predicted property condition after improvements. Includes simulated debt servicing. Does not account for taxes, vacancy, or strata.
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
                    <p className="text-[11px] sm:text-[10px] font-bold text-[#4A4137]/40 uppercase tracking-widest mt-0.5">Knockdown / Duplex / Townhouse Potential</p>
                 </div>
              </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.developmentScenarios.map((scenario, i) => (
                <div key={i} className="p-8 rounded-[2.5rem] border shadow-sm transition-all group border-b-4 flex flex-col hover:shadow-md" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                   <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                         <h3 className="text-lg font-bold text-[#4A4137]">{scenario.title}</h3>
                         <div className="flex flex-wrap gap-2">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${getEligibilityBadgeColor(scenario.eligibility)}`}>{scenario.eligibility}</span>
                            <PathwayBadgeWithTooltip pathway={scenario.planningPathway} />
                         </div>
                      </div>
                   </div>
                   <p className="text-sm text-[#4A4137]/60 leading-relaxed mb-4">{scenario.description}</p>
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
                      <p className="text-[10px] font-bold text-[#4A4137]/50 uppercase tracking-widest mb-1">Rationale</p>
                      <p className="text-xs text-[#4A4137]/70 italic leading-relaxed">{scenario.whyAllowedOrNot}</p>
                   </div>
                   <div className="grid grid-cols-1 gap-4 mb-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <p className="text-[10px] font-black text-[#4A4137]/50 uppercase tracking-widest mb-1">Est. Build Cost</p>
                         <p className="text-lg font-bold text-[#4A4137]">{formatValue(scenario.estimatedCost?.low)} – {formatValue(scenario.estimatedCost?.high)}</p>
                      </div>
                   </div>
                   {scenario.estimatedNetProfit && (
                     <div className="p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 mb-2 mt-auto">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 text-center text-emerald-700">INDICATIVE DEVELOPMENT MARGIN</p>
                        <p className="text-2xl font-black text-emerald-700 text-center">{formatValue(scenario.estimatedNetProfit.low)} – {formatValue(scenario.estimatedNetProfit.high)}</p>
                     </div>
                   )}
                </div>
              ))}
           </div>
        </section>
      )}

      {/* APPROVAL PATHWAY & ZONING INTEL */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 pdf-no-break" data-pdf-page-break>
        {data.approvalPathway && (
          <div className="p-10 rounded-[3rem] border shadow-sm space-y-8" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-md"><i className="fa-solid fa-file-shield"></i></div>
                <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Approval Pathway</h2>
             </div>
             <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                <div className="mb-4"><PathwayBadgeWithTooltip pathway={data.approvalPathway.likelyPathway} /></div>
                <p className="text-sm text-[#4A4137]/60 leading-relaxed">{data.approvalPathway.explanation}</p>
             </div>
          </div>
        )}
        {data.zoningIntel && (
          <div className="bg-[#D3D9B5]/10 p-10 rounded-[3rem] border border-[#D3D9B5]/20 space-y-8">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#D3D9B5] text-white rounded-xl flex items-center justify-center shadow-md"><i className="fa-solid fa-map-location-dot"></i></div>
                <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Zoning Intel</h2>
             </div>
             <div className="px-6 py-4 bg-white rounded-3xl border border-[#D3D9B5]/20 text-center space-y-2 shadow-sm">
                <p className="text-[10px] font-black text-[#4A4137]/40 uppercase tracking-widest">Zone Code</p>
                <p className="text-2xl font-black text-[#4A4137] tracking-widest">{data.zoningIntel.currentZoneCode}</p>
                <p className="text-xs font-bold text-[#D3D9B5] uppercase">{data.zoningIntel.currentZoneTitle}</p>
             </div>
             <p className="text-sm text-[#4A4137]/70 font-medium leading-relaxed">{data.zoningIntel.whatItMeans}</p>
          </div>
        )}
      </section>

      {/* COMPARABLE SALES */}
      {data.comparableSales && (
        <section className="space-y-8 pdf-no-break">
           <div className="flex items-center gap-4 px-4">
              <div className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-sm"><i className="fa-solid fa-tags"></i></div>
              <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Comparable Market Sales</h2>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" data-pdf-sales-grid>
              <div className="lg:col-span-2 space-y-6">
                 {data.comparableSales.nearbySales && data.comparableSales.nearbySales.length > 0 && (
                   <div className="p-8 rounded-[3rem] border shadow-sm space-y-4" data-pdf-no-break style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                      {data.comparableSales.nearbySales.map((sale, i) => (
                         <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group transition-all hover:border-[#D6A270]/20">
                            <div className="flex gap-4 items-center">
                               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[10px] font-bold text-[#4A4137]/40 shadow-sm">{sale.distanceKm ? `${sale.distanceKm}km` : '–'}</div>
                               <div className="space-y-0.5">
                                  <p className="text-sm font-bold text-[#4A4137]">{sale.addressShort}</p>
                                  <p className="text-[10px] text-[#4A4137]/40">{sale.date}</p>
                               </div>
                            </div>
                            <p className="text-sm font-black text-[#D6A270]">{formatValue(sale.price)}</p>
                         </div>
                      ))}
                   </div>
                 )}
              </div>
              <div className="bg-[#4A4137] p-8 rounded-[3rem] text-white space-y-6 relative overflow-hidden h-fit" data-pdf-no-break>
                 <p className="text-sm font-medium leading-relaxed text-white/80">{data.comparableSales.pricingContextSummary}</p>
              </div>
           </div>
        </section>
      )}

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

      <footer className="pt-10 pb-6">
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