import React, { useState } from 'react';
import { PropertyData, PlanType, DevEligibility } from '../types';

interface PropertyResultsProps {
  data: PropertyData;
  address: string;
  plan: PlanType;
  onUpgrade: () => void;
}

const PropertyResults: React.FC<PropertyResultsProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState<Set<number>>(new Set());
  const [selectedDevScenarioIndex, setSelectedDevScenarioIndex] = useState<number | null>(null);

  // Determine if the property is likely under a strata scheme
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

  const handleShare = async () => {
    const shareParams = {
      title: `Propwise Report: ${data.address}`,
      text: data?.sharePrompt?.message || `Check out the property DNA for ${data.address}`,
      url: window.location.href
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareParams);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    const text = `${data?.sharePrompt?.message || 'Check out this property audit'}\n\n${window.location.href}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data) return null;

  const findBestStrategyIndex = () => {
    if (!data.valueAddStrategies || data.valueAddStrategies.length === 0) return -1;
    
    const bestTitle = data.portfolioSelloutSummary?.bestStrategyByProfit;
    if (bestTitle) {
      const index = data.valueAddStrategies.findIndex(s => 
        s.title.trim().toLowerCase() === bestTitle.trim().toLowerCase()
      );
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
    : (data.valueAddStrategies && data.valueAddStrategies.length > 0 
        ? new Set([findBestStrategyIndex()]) 
        : new Set<number>());

  // Calculation Logic
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

  const selectedDevScenario = selectedDevScenarioIndex !== null ? data.developmentScenarios?.[selectedDevScenarioIndex] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-32 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* Header Property Summary */}
      <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-[#D6A270]/10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D6A270]/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="space-y-6 relative z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#D6A270]/10 text-[#D6A270] rounded-full text-[10px] font-bold uppercase tracking-[0.2em]">
                Property Strategy Guide
              </div>
              <button 
                onClick={handleShare}
                className="text-[10px] font-black uppercase tracking-widest text-[#4A4137]/30 hover:text-[#D6A270] transition-colors flex items-center gap-1"
              >
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-share-nodes'}`}></i>
                {copied ? 'Copied' : 'Share'}
              </button>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-2 text-[#4A4137]/60 font-bold text-sm">
                  <i className="fa-solid fa-bed text-[#D6A270]"></i> {data?.attributes?.beds || 0}
               </div>
               <div className="flex items-center gap-2 text-[#4A4137]/60 font-bold text-sm">
                  <i className="fa-solid fa-bath text-[#D6A270]"></i> {data?.attributes?.baths || 0}
               </div>
               <div className="flex items-center gap-2 text-[#4A4137]/60 font-bold text-sm">
                  <i className="fa-solid fa-car text-[#D6A270]"></i> {data?.attributes?.cars || 0}
               </div>
            </div>
          </div>
          <div>
            <h1 className="text-4xl md:text-6xl font-bold text-[#4A4137] tracking-tighter font-address leading-tight">
              {data.address}
            </h1>
            <p className="text-[#4A4137]/40 font-medium mt-2">{data.propertyType} • {data.landSize || 'Unknown Land Size'}</p>
          </div>

          <div className="flex flex-wrap gap-8 pt-8 border-t border-slate-100">
             <div className="space-y-1">
                <p className="text-[10px] font-bold text-[#4A4137]/30 uppercase tracking-widest">Estimated Market Value</p>
                <p className="text-2xl font-black text-[#D6A270]">{formatValue(data?.valueSnapshot?.indicativeMidpoint)}</p>
             </div>
             <div className="space-y-1">
                <p className="text-[10px] font-bold text-[#4A4137]/30 uppercase tracking-widest">Potential Market Value After Improvements</p>
                <p className={`text-2xl font-black transition-colors ${effectiveSelection.size > 0 ? 'text-[#D3D9B5]' : 'text-[#4A4137]'}`}>
                   {baseline === undefined ? 'TBA' : 
                    effectiveSelection.size === 0 ? formatValue(baseline) : 
                    `${formatValue(afterLow)} – ${formatValue(afterHigh)}`}
                </p>
             </div>
             <div className="space-y-1">
                <p className="text-[10px] font-bold text-[#4A4137]/30 uppercase tracking-widest">Growth Trend</p>
                <p className="text-2xl font-black text-[#4A4137]">{data?.valueSnapshot?.growth || 'TBA'}</p>
             </div>
             <div className="space-y-1">
                <p className="text-[10px] font-bold text-[#4A4137]/30 uppercase tracking-widest">Best Development End Value</p>
                <p className="text-2xl font-black text-[#4A4137]">
                   {selectedDevScenario?.estimatedEndValue ? 
                    `${formatValue(selectedDevScenario.estimatedEndValue.low)} – ${formatValue(selectedDevScenario.estimatedEndValue.high)}` : 
                    'TBA'}
                </p>
             </div>
             <div className="space-y-1">
                <p className="text-[10px] font-bold text-[#4A4137]/30 uppercase tracking-widest">Data Confidence</p>
                <p className="text-2xl font-black text-[#4A4137] flex items-center gap-2">
                   {data?.valueSnapshot?.confidenceLevel || 'Low'}
                   <i className={`fa-solid fa-circle-check text-xs ${data?.valueSnapshot?.confidenceLevel === 'High' ? 'text-emerald-500' : 'text-amber-500'}`}></i>
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* PORTFOLIO SELL-OUT SUMMARY */}
      {data.portfolioSelloutSummary && (
        <div className="bg-[#4A4137] p-8 md:p-12 rounded-[3.5rem] text-white shadow-xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-[#D6A270]/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-[#D6A270]/20 transition-all duration-1000"></div>
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="flex-shrink-0 w-20 h-20 bg-[#D6A270] rounded-3xl flex items-center justify-center text-3xl shadow-lg">
                 <i className="fa-solid fa-sack-dollar"></i>
              </div>
              <div className="flex-grow space-y-4 text-center md:text-left">
                 <div>
                    <span className="text-[10px] font-black text-[#D6A270] uppercase tracking-[0.3em] mb-1 block">Best Strategy Uplift</span>
                    <h3 className="text-2xl font-bold tracking-tight">{data.portfolioSelloutSummary.bestStrategyByProfit}</h3>
                 </div>
                 <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="space-y-1">
                       <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Indicative Predicted Profit From Sale</p>
                       <p className="text-3xl font-black text-[#D6A270]">
                          {formatValue(data.portfolioSelloutSummary.estimatedNetProfitRange?.low)} – {formatValue(data.portfolioSelloutSummary.estimatedNetProfitRange?.high)}
                       </p>
                    </div>
                 </div>
                 <p className="text-sm text-white/60 leading-relaxed max-w-xl italic">
                    "{data.portfolioSelloutSummary.selloutExplanation}"
                 </p>
              </div>
           </div>
        </div>
      )}

      {/* VALUE-ADD STRATEGIES */}
      {data.valueAddStrategies && data.valueAddStrategies.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between px-4">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#D3D9B5] text-white rounded-xl flex items-center justify-center shadow-sm">
                   <i className="fa-solid fa-hammer"></i>
                </div>
                <div>
                   <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Uplift & Value-Add Strategies</h2>
                   <p className="text-[10px] font-bold text-[#D3D9B5] uppercase tracking-widest mt-0.5">Renovation & Potential Development</p>
                </div>
             </div>
             {selectedStrategies.size > 0 && (
                <button 
                   onClick={() => setSelectedStrategies(new Set())}
                   className="text-[10px] font-black uppercase tracking-widest text-[#4A4137]/40 hover:text-[#D6A270] transition-colors"
                >
                   Reset Selections
                </button>
             )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {data.valueAddStrategies.map((strategy, i) => (
               <div key={i} className={`bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all group border-b-4 flex flex-col ${selectedStrategies.has(i) ? 'border-[#D3D9B5] shadow-md ring-1 ring-[#D3D9B5]/20' : 'border-slate-100 border-b-[#D6A270]/20 hover:shadow-md'}`}>
                  <div className="flex justify-between items-start mb-4">
                     <div className="space-y-1">
                        <h3 className="text-lg font-bold text-[#4A4137] group-hover:text-[#D6A270] transition-colors">{strategy.title}</h3>
                        <PathwayBadgeWithTooltip pathway={strategy.planningPathway} />
                     </div>
                     <div className="flex flex-col items-end gap-2">
                        <button 
                           onClick={() => toggleStrategy(i)}
                           className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${selectedStrategies.has(i) ? 'bg-[#D3D9B5] text-white border-[#D3D9B5]' : 'bg-white text-[#4A4137]/40 border-slate-200 hover:border-[#D3D9B5] hover:text-[#D3D9B5]'}`}
                        >
                           {selectedStrategies.has(i) ? <><i className="fa-solid fa-check mr-1"></i> Included</> : 'Include'}
                        </button>
                        <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getEffortColor(strategy.effort)}`}>
                           {strategy.effort} Effort
                        </div>
                     </div>
                  </div>
                  <p className="text-sm text-[#4A4137]/60 leading-relaxed mb-6">{strategy.description}</p>
                  
                  {/* COMPACT UI FOR RENOVATION STRATEGIES */}
                  <div className="grid grid-cols-2 gap-3 mb-2 mt-auto">
                     <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
                        <p className="text-[8px] font-black text-[#4A4137]/50 uppercase tracking-widest mb-1">Estimated Cost</p>
                        <p className="text-sm font-bold text-[#4A4137]">{formatValue(strategy.estimatedCost?.low)} – {formatValue(strategy.estimatedCost?.high)}</p>
                     </div>
                     {(strategy.indicativeEquityUplift || strategy.saleProfitEstimate) && (
                       <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col justify-center">
                          <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Equity Gain $</p>
                          <p className="text-sm font-black text-emerald-700">
                             {strategy.indicativeEquityUplift ? 
                               `${formatValue(strategy.indicativeEquityUplift.low)} – ${formatValue(strategy.indicativeEquityUplift.high)}` :
                               `${formatValue(strategy.saleProfitEstimate?.low)} – ${formatValue(strategy.saleProfitEstimate?.high)}`}
                          </p>
                       </div>
                     )}
                  </div>
               </div>
             ))}
          </div>
        </section>
      )}

      {/* DEVELOPMENT SCENARIOS */}
      {data.developmentScenarios && data.developmentScenarios.length > 0 && (
        <section className="space-y-6">
           <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-[#4A4137] text-white rounded-xl flex items-center justify-center shadow-sm">
                    <i className="fa-solid fa-city"></i>
                 </div>
                 <div>
                    <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Development Scenarios</h2>
                    <p className="text-[10px] font-bold text-[#4A4137]/40 uppercase tracking-widest mt-0.5">Knockdown / Duplex / Townhouse Potential</p>
                 </div>
              </div>
              {selectedDevScenarioIndex !== null && (
                <button 
                   onClick={() => setSelectedDevScenarioIndex(null)}
                   className="text-[10px] font-black uppercase tracking-widest text-[#4A4137]/40 hover:text-[#D6A270] transition-colors"
                >
                   Reset Selection
                </button>
              )}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.developmentScenarios.map((scenario, i) => (
                <div key={i} className={`bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all group border-b-4 flex flex-col ${selectedDevScenarioIndex === i ? 'border-[#4A4137] shadow-md ring-1 ring-[#4A4137]/10' : 'border-slate-100 border-b-slate-200 hover:shadow-md'}`}>
                   <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                         <h3 className="text-lg font-bold text-[#4A4137]">{scenario.title}</h3>
                         <div className="flex flex-wrap gap-2">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${getEligibilityBadgeColor(scenario.eligibility)}`}>
                               {scenario.eligibility}
                            </span>
                            <PathwayBadgeWithTooltip pathway={scenario.planningPathway} />
                         </div>
                      </div>
                      <button 
                         onClick={() => scenario.eligibility !== 'Not Allowed' && setSelectedDevScenarioIndex(i)}
                         disabled={scenario.eligibility === 'Not Allowed'}
                         className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${selectedDevScenarioIndex === i ? 'bg-[#4A4137] text-white border-[#4A4137]' : scenario.eligibility === 'Not Allowed' ? 'bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed' : 'bg-white text-[#4A4137]/40 border-slate-200 hover:border-[#4A4137] hover:text-[#4A4137]'}`}
                      >
                         {selectedDevScenarioIndex === i ? <><i className="fa-solid fa-check mr-1"></i> Selected</> : scenario.eligibility === 'Not Allowed' ? 'Not Permitted' : 'Select Scenario'}
                      </button>
                   </div>
                   
                   <p className="text-sm text-[#4A4137]/60 leading-relaxed mb-4">{scenario.description}</p>
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
                      <p className="text-[10px] font-bold text-[#4A4137]/50 uppercase tracking-widest mb-1">Rationale</p>
                      <p className="text-xs text-[#4A4137]/70 italic leading-relaxed">{scenario.whyAllowedOrNot}</p>
                   </div>

                   {/* RESTORED PROMINENT LAYOUT FOR DEVELOPMENT SCENARIOS */}
                   <div className="grid grid-cols-1 gap-4 mb-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <p className="text-[10px] font-black text-[#4A4137]/50 uppercase tracking-widest mb-1">Est. Build Cost</p>
                         <p className="text-lg font-bold text-[#4A4137]">{formatValue(scenario.estimatedCost?.low)} – {formatValue(scenario.estimatedCost?.high)}</p>
                      </div>
                   </div>

                   {scenario.estimatedNetProfit && (
                     <div className="p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 mb-2 mt-auto">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 text-center text-emerald-700">INDICATIVE DEVELOPMENT MARGIN</p>
                        <p className="text-2xl font-black text-emerald-700 text-center">
                           {formatValue(scenario.estimatedNetProfit.low)} – {formatValue(scenario.estimatedNetProfit.high)}
                        </p>
                     </div>
                   )}

                   {(scenario.keyConstraints?.length || 0) > 0 && (
                      <div className="mt-4 space-y-2">
                         <p className="text-[8px] font-black text-[#4A4137]/50 uppercase tracking-widest">Controls & Constraints</p>
                         <div className="flex flex-wrap gap-1">
                            {scenario.keyConstraints?.map((c, idx) => (
                               <span key={idx} className="px-2 py-0.5 bg-slate-100 text-[#4A4137]/50 rounded text-[9px] font-medium">{c}</span>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
              ))}
           </div>
        </section>
      )}

      {/* APPROVAL PATHWAY & ZONING INTEL */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {data.approvalPathway && (
          <div className="bg-white p-10 rounded-[3rem] border border-[#D6A270]/10 shadow-sm space-y-8">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-md">
                   <i className="fa-solid fa-file-shield"></i>
                </div>
                <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Approval Pathway</h2>
             </div>
             <div className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                   <div className="mb-4">
                     <PathwayBadgeWithTooltip pathway={data.approvalPathway.likelyPathway} />
                   </div>
                   <p className="text-sm text-[#4A4137]/60 leading-relaxed">{data.approvalPathway.explanation}</p>
                   {data.approvalPathway.estimatedApprovalTimeWeeks && (
                     <p className="mt-4 text-[10px] font-bold text-[#4A4137]/60 uppercase tracking-widest">
                       Approx: {(data.approvalPathway.estimatedApprovalTimeWeeks.low && data.approvalPathway.estimatedApprovalTimeWeeks.high && typeof data.approvalPathway.estimatedApprovalTimeWeeks.low === 'number') 
                         ? `${data.approvalPathway.estimatedApprovalTimeWeeks.low} – ${data.approvalPathway.estimatedApprovalTimeWeeks.high}` 
                         : (data.approvalPathway.estimatedApprovalTimeWeeks.low || 'TBA')} weeks
                     </p>
                   )}
                </div>
             </div>
          </div>
        )}

        {data.zoningIntel && (
          <div className="bg-[#D3D9B5]/10 p-10 rounded-[3rem] border border-[#D3D9B5]/20 space-y-8">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#D3D9B5] text-white rounded-xl flex items-center justify-center shadow-md">
                   <i className="fa-solid fa-map-location-dot"></i>
                </div>
                <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Zoning Intel</h2>
             </div>
             <div className="space-y-6">
                <div className="px-6 py-4 bg-white rounded-3xl border border-[#D3D9B5]/20 text-center space-y-2 shadow-sm">
                   <p className="text-[10px] font-black text-[#4A4137]/40 uppercase tracking-widest">Zone Code</p>
                   <p className="text-2xl font-black text-[#4A4137] tracking-widest">{data.zoningIntel.currentZoneCode}</p>
                   <p className="text-xs font-bold text-[#D3D9B5] uppercase">{data.zoningIntel.currentZoneTitle}</p>
                </div>
                <p className="text-sm text-[#4A4137]/70 font-medium leading-relaxed">{data.zoningIntel.whatItMeans}</p>
                {data.zoningIntel.recentChanges && data.zoningIntel.recentChanges.length > 0 && (
                  <div className="pt-4 space-y-4">
                    <p className="text-[10px] font-black text-[#D3D9B5] uppercase tracking-widest">Recent Rezoning History (24 Months)</p>
                    {data.zoningIntel.recentChanges.map((change, idx) => (
                      <div key={idx} className="bg-white/50 p-4 rounded-2xl border border-[#D3D9B5]/10">
                         <p className="text-xs font-black text-[#4A4137]">{change.changeTitle}</p>
                         <p className="text-[10px] text-[#4A4137]/40 mb-2">{change.date}</p>
                         <p className="text-[11px] text-[#4A4137]/60 italic">{change.impactOnOwner}</p>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        )}
      </section>

      {/* COMPARABLE SALES */}
      {data.comparableSales && (
        <section className="space-y-8">
           <div className="flex items-center gap-4 px-4">
              <div className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-sm">
                 <i className="fa-solid fa-tags"></i>
              </div>
              <div>
                 <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Comparable Market Sales</h2>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Recent Transaction Context</p>
              </div>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                 {data.comparableSales.nearbySales && data.comparableSales.nearbySales.length > 0 && (
                   <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-[#4A4137]/40 uppercase tracking-widest">Nearby Relevant Sales</h3>
                      <div className="space-y-4">
                         {data.comparableSales.nearbySales.map((sale, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group transition-all hover:border-[#D6A270]/20">
                               <div className="flex gap-4 items-center">
                                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[10px] font-bold text-[#4A4137]/40 shadow-sm">
                                     {sale.distanceKm ? `${sale.distanceKm}km` : '–'}
                                  </div>
                                  <div className="space-y-0.5">
                                     <p className="text-sm font-bold text-[#4A4137]">{sale.addressShort}</p>
                                     <p className="text-[10px] text-[#4A4137]/40">{sale.date}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <p className="text-sm font-black text-[#D6A270]">{formatValue(sale.price)}</p>
                                  <a href={sale.sourceUrl} target="_blank" rel="noopener" className="text-[8px] uppercase tracking-widest font-bold text-[#4A4137]/40 hover:text-[#D6A270]">Source View</a>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                 )}
              </div>
              <div className="bg-[#4A4137] p-8 rounded-[3rem] text-white space-y-6 relative overflow-hidden h-fit">
                 <h3 className="text-xs font-black text-white/30 uppercase tracking-widest relative z-10">Pricing Context</h3>
                 <p className="text-sm font-medium leading-relaxed text-white/80 relative z-10">
                    {data.comparableSales.pricingContextSummary}
                 </p>
              </div>
           </div>
        </section>
      )}

      {/* LOCAL AREA INTEL */}
      {data.localAreaIntel && (
        <section className="space-y-8">
           <div className="flex items-center gap-4 px-4">
              <div className="w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                 <i className="fa-solid fa-map-pin"></i>
              </div>
              <div>
                 <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Local Area</h2>
                 <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">Schools & Transport Access</p>
              </div>
           </div>

           {data.localAreaIntel.lifestyleSummary && (
             <p className="px-4 text-sm text-[#4A4137]/60 font-medium leading-relaxed italic text-center max-w-3xl mx-auto">
               "{data.localAreaIntel.lifestyleSummary}"
             </p>
           )}

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Schools Sub-Section */}
              <div className="bg-white p-8 rounded-[3rem] border border-indigo-100 shadow-sm space-y-6">
                 <div className="flex items-center gap-2 mb-2">
                    <i className="fa-solid fa-school text-indigo-500 text-sm"></i>
                    <h3 className="text-xs font-black text-[#4A4137]/40 uppercase tracking-widest">School Catchments</h3>
                 </div>
                 <div className="space-y-6">
                    {/* Primary Schools */}
                    {data.localAreaIntel.schools?.primary && data.localAreaIntel.schools.primary.length > 0 && (
                      <div className="space-y-3">
                         <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Primary Education</p>
                         <div className="space-y-2">
                            {data.localAreaIntel.schools.primary.map((school, i) => (
                               <div key={i} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                                  <div className="space-y-0.5">
                                     <p className="text-xs font-bold text-[#4A4137]">{school.name}</p>
                                     <div className="flex gap-2 items-center">
                                        <span className="text-[8px] font-black uppercase text-indigo-400">{school.type}</span>
                                        {school.ratingHint && <span className="text-[8px] text-[#4A4137]/40 font-medium">• {school.ratingHint}</span>}
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[10px] font-black text-[#4A4137]/40">{school.distanceKm !== undefined ? `${school.distanceKm}km` : '–'}</p>
                                     {school.sourceUrl && <a href={school.sourceUrl} target="_blank" rel="noopener" className="text-[8px] font-bold uppercase text-indigo-300 hover:text-indigo-500">View</a>}
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                    )}
                    {/* Secondary Schools */}
                    {data.localAreaIntel.schools?.secondary && data.localAreaIntel.schools.secondary.length > 0 && (
                      <div className="space-y-3">
                         <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Secondary Education</p>
                         <div className="space-y-2">
                            {data.localAreaIntel.schools.secondary.map((school, i) => (
                               <div key={i} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                                  <div className="space-y-0.5">
                                     <p className="text-xs font-bold text-[#4A4137]">{school.name}</p>
                                     <div className="flex gap-2 items-center">
                                        <span className="text-[8px] font-black uppercase text-indigo-400">{school.type}</span>
                                        {school.ratingHint && <span className="text-[8px] text-[#4A4137]/40 font-medium">• {school.ratingHint}</span>}
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[10px] font-black text-[#4A4137]/40">{school.distanceKm !== undefined ? `${school.distanceKm}km` : '–'}</p>
                                     {school.sourceUrl && <a href={school.sourceUrl} target="_blank" rel="noopener" className="text-[8px] font-bold uppercase text-indigo-300 hover:text-indigo-500">View</a>}
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                    )}
                 </div>
              </div>

              {/* Transport Sub-Section */}
              <div className="bg-slate-50 p-8 rounded-[3rem] border border-indigo-50 shadow-sm space-y-6">
                 <div className="flex items-center gap-2 mb-2">
                    <i className="fa-solid fa-train-subway text-indigo-500 text-sm"></i>
                    <h3 className="text-xs font-black text-[#4A4137]/40 uppercase tracking-widest">Transport Connectivity</h3>
                 </div>
                 <div className="space-y-6">
                    {/* Train Stations */}
                    {data.localAreaIntel.transport?.trainStations && data.localAreaIntel.transport.trainStations.length > 0 && (
                      <div className="space-y-3">
                         <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Rail Access</p>
                         <div className="space-y-2">
                            {data.localAreaIntel.transport.trainStations.map((station, i) => (
                               <div key={i} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-indigo-50 shadow-sm">
                                  <div className="space-y-0.5">
                                     <p className="text-xs font-bold text-[#4A4137]">{station.name}</p>
                                     <p className="text-[8px] font-black uppercase text-indigo-400">{station.lineOrNetwork}</p>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[10px] font-black text-[#4A4137]/40">{station.distanceKm !== undefined ? `${station.distanceKm}km` : '–'}</p>
                                     {station.typicalTravelTimeToCBD && <p className="text-[8px] font-bold text-indigo-400/60 uppercase">{station.typicalTravelTimeToCBD} to CBD</p>}
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                    )}
                    {/* Bus Stops */}
                    {data.localAreaIntel.transport?.busStops && data.localAreaIntel.transport.busStops.length > 0 && (
                      <div className="space-y-3">
                         <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Bus Links</p>
                         <div className="space-y-2">
                            {data.localAreaIntel.transport.busStops.map((stop, i) => (
                               <div key={i} className="p-3 bg-white rounded-2xl border border-indigo-50 shadow-sm space-y-2">
                                  <div className="flex justify-between items-start">
                                     <p className="text-xs font-bold text-[#4A4137]">{stop.name}</p>
                                     <p className="text-[10px] font-black text-[#4A4137]/40">{stop.distanceKm !== undefined ? `${stop.distanceKm}km` : '–'}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                     {stop.routes?.map((route, idx) => (
                                        <span key={idx} className="px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded text-[8px] font-black tracking-widest">{route}</span>
                                     ))}
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </section>
      )}

      {/* WATCH OUTS */}
      {data.watchOuts && data.watchOuts.length > 0 && (
        <section className="bg-rose-50/50 p-10 md:p-14 rounded-[4rem] border border-rose-100 space-y-8">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-200">
                <i className="fa-solid fa-eye"></i>
             </div>
             <div>
                <h2 className="text-2xl font-bold text-[#4A4137] tracking-tight">Things to Watch Out For</h2>
                <p className="text-[10px] font-bold text-rose-500/60 uppercase tracking-widest mt-0.5">Potential Dealbreakers & Risks</p>
             </div>
          </div>
          <div className="grid grid-cols-1 gap-6">
             {data.watchOuts.map((wo, i) => (
               <div key={i} className="bg-white p-8 rounded-[2.5rem] flex flex-col md:flex-row gap-6 border border-rose-100 shadow-sm relative overflow-hidden group">
                  <div className="flex-shrink-0 mt-1 text-2xl">{getSeverityIcon(wo.severity)}</div>
                  <div className="space-y-3 flex-grow">
                     <div>
                        <h3 className="text-lg font-bold text-[#4A4137]">{wo.title}</h3>
                        <p className="text-sm text-[#4A4137]/60 leading-relaxed">{wo.description}</p>
                     </div>
                     <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100/30">
                        <h4 className="text-[9px] font-black text-rose-500/60 uppercase tracking-widest mb-1">Consequence</h4>
                        <p className="text-xs font-medium text-[#4A4137]/70 italic leading-relaxed">
                          "{wo.consequence}"
                        </p>
                     </div>
                  </div>
               </div>
             ))}
          </div>
        </section>
      )}

      {/* INVESTMENT VERDICT */}
      <section className="bg-[#4A4137] p-10 md:p-16 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-[#D6A270]/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#D6A270] text-white rounded-2xl flex items-center justify-center shadow-lg">
                   <i className="fa-solid fa-gavel text-xl"></i>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Strategy Verdict</h2>
             </div>
          </div>
          <p className="text-lg md:text-xl font-medium leading-relaxed text-white/90">
            {data.investmentVerdict}
          </p>
        </div>
      </section>

      {/* SHARE WITH PARTNER CARD */}
      <section className="max-w-2xl mx-auto">
         <div className="bg-white p-10 rounded-[3rem] border border-[#D6A270]/10 shadow-xl text-center space-y-6 relative overflow-hidden">
            <div className="space-y-2 relative z-10">
               <h3 className="text-xl font-bold text-[#4A4137]">{data?.sharePrompt?.headline || 'Share Analysis'}</h3>
               <p className="text-sm text-[#4A4137]/50 max-w-sm mx-auto font-medium">{data?.sharePrompt?.message || 'Send this property audit to a partner or advisor.'}</p>
            </div>
            <button 
               onClick={handleShare}
               className="relative z-10 px-8 py-4 bg-[#D6A270] text-white rounded-2xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#4A4137] transition-all flex items-center gap-3 mx-auto shadow-lg shadow-[#D6A270]/20 active:scale-95"
            >
               <i className={`fa-solid ${copied ? 'fa-check' : 'fa-share-nodes'}`}></i>
               {copied ? 'Copied' : (data?.sharePrompt?.ctaLabel || 'Share Report')}
            </button>
         </div>
      </section>

      {/* SOURCES & FOOTER */}
      <footer className="space-y-10 pt-10">
        <div className="text-center px-10">
          <p className="text-[10px] text-[#4A4137]/30 leading-relaxed max-w-sm mx-auto italic">
            This guide is an automated strategy simulation based on public data and AI interpretation. Always consult with a licensed professional before making financial or legal decisions.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PropertyResults;