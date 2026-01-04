import React, { useState } from 'react';
import type { ScoreResult, SubScore } from '../utils/upblockScore';

type Props = {
  result: ScoreResult;
};

const SUB_SCORE_LABELS: Record<SubScore['name'], string> = {
  yield: 'Yield',
  cashFlow: 'Cash Flow',
  uplift: 'Uplift Potential',
  constraints: 'Constraints',
};

// Get label color class
function getLabelColor(label: string, isPositive: boolean): string {
  if (label === 'Unknown') return 'text-slate-400';
  if (isPositive) return 'text-emerald-600';
  return 'text-amber-600';
}

// Generate a detailed, insightful summary based on the score result
function generateSummary(result: ScoreResult): string {
  const subs = Object.fromEntries(result.subs.map(s => [s.name, s]));
  const cashFlow = subs.cashFlow;
  const yieldSub = subs.yield;
  const uplift = subs.uplift;
  const constraints = subs.constraints;
  
  const paragraphs: string[] = [];
  
  // Overall score context
  if (result.score >= 80) {
    paragraphs.push("This property shows strong investment fundamentals across multiple metrics.");
  } else if (result.score >= 65) {
    paragraphs.push("This property presents a moderate opportunity with some areas requiring attention.");
  } else if (result.score >= 50) {
    paragraphs.push("This property has mixed signals — careful due diligence is recommended before proceeding.");
  } else {
    paragraphs.push("This property faces several challenges that may impact returns. Proceed with caution.");
  }
  
  // Cash flow analysis
  if (cashFlow.label !== 'Unknown') {
    const weeklyMatch = cashFlow.detail.match(/([+-]?\$?-?\d+)/);
    const weekly = weeklyMatch ? parseInt(weeklyMatch[1].replace(/[$,]/g, '')) : 0;
    
    if (weekly >= 100) {
      paragraphs.push(`The strong positive cash flow of ${cashFlow.detail} provides a solid income buffer, reducing holding risk and supporting long-term ownership.`);
    } else if (weekly >= 0) {
      paragraphs.push(`Cash flow is roughly neutral at ${cashFlow.detail}, meaning the property should cover its own costs without significant out-of-pocket contributions.`);
    } else if (weekly >= -200) {
      paragraphs.push(`The property is negatively geared at ${cashFlow.detail}. While this creates a holding cost, it may suit investors seeking capital growth or tax benefits. Ensure you can comfortably cover the shortfall.`);
    } else {
      paragraphs.push(`Significant negative cash flow of ${cashFlow.detail} represents a substantial holding cost. This level of negative gearing requires strong income or alternative strategy to sustain.`);
    }
  }
  
  // Uplift + constraints interplay
  if (uplift.label !== 'Unknown' && constraints.label !== 'Unknown') {
    const hasGoodUplift = uplift.score >= 70;
    const hasFewConstraints = constraints.score >= 75;
    
    if (hasGoodUplift && hasFewConstraints) {
      paragraphs.push(`Value-add potential looks promising with ${uplift.detail.toLowerCase()} and minimal planning hurdles. This combination suggests renovation or development strategies could be executed relatively smoothly.`);
    } else if (hasGoodUplift && !hasFewConstraints) {
      paragraphs.push(`While uplift potential exists (${uplift.detail.toLowerCase()}), planning constraints may complicate or delay value-add strategies. Engage a town planner early to understand approval pathways.`);
    } else if (!hasGoodUplift && hasFewConstraints) {
      paragraphs.push(`Limited uplift potential is identified, though few planning constraints exist. Consider whether the property suits a buy-and-hold strategy rather than active value creation.`);
    }
  } else if (uplift.label !== 'Unknown') {
    if (uplift.score >= 70) {
      paragraphs.push(`Uplift potential of ${uplift.detail.toLowerCase()} is encouraging, though constraint data is incomplete. Verify zoning and overlays before committing to a value-add strategy.`);
    }
  }
  
  // Yield context
  if (yieldSub.label !== 'Unknown') {
    if (yieldSub.score >= 75) {
      paragraphs.push(`The yield (${yieldSub.detail.toLowerCase()}) is above average for the market, indicating solid rental demand relative to price.`);
    } else if (yieldSub.score <= 40) {
      paragraphs.push(`Below-average yield (${yieldSub.detail.toLowerCase()}) suggests the property may be priced for capital growth rather than income. This is common in premium locations but increases reliance on future appreciation.`);
    }
  }
  
  // Missing data warning
  const unknownMetrics = result.subs.filter(s => s.label === 'Unknown').map(s => SUB_SCORE_LABELS[s.name].toLowerCase());
  if (unknownMetrics.length > 0) {
    paragraphs.push(`Note: ${unknownMetrics.join(' and ')} data is incomplete, which limits scoring accuracy. Source this information to refine the analysis.`);
  }
  
  // Confidence caveat
  if (result.confidenceLabel === 'Low') {
    paragraphs.push("Due to limited data, treat this score as directional only. Additional research is strongly recommended.");
  }
  
  return paragraphs.join(' ');
}

export function UpblockScoreCard({ result }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const scoreDisplay = result.scoreRange
    ? `${result.scoreRange.low}–${result.scoreRange.high}`
    : `${result.score}`;

  const confidenceColor = {
    High: 'bg-emerald-100 text-emerald-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-slate-100 text-slate-600',
  }[result.confidenceLabel];

  return (
    <div 
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ 
        backgroundColor: 'var(--bg-card)', 
        borderColor: 'var(--border-color)' 
      }}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-xs`} style={{ color: 'var(--text-muted)' }}></i>
            <span className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Upblock Deal Score
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${confidenceColor}`}>
            {result.confidenceLabel} Confidence
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black" style={{ color: '#C9A961' }}>
            {scoreDisplay}
          </span>
          <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>/100</span>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-5 border-t" style={{ borderColor: 'var(--border-color)' }}>
          {/* Top Drivers */}
          <div className="pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Positive Drivers */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                <i className="fa-solid fa-arrow-trend-up mr-1"></i> Strengths
              </p>
              {result.drivers.positive.map((driver) => (
                <div 
                  key={driver.name}
                  className={`p-3 rounded-xl border ${driver.label === 'Unknown' ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50 border-emerald-100'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${driver.label === 'Unknown' ? 'text-slate-600' : 'text-emerald-800'}`}>
                      {SUB_SCORE_LABELS[driver.name]}
                    </span>
                    <span className={`text-xs font-bold ${getLabelColor(driver.label, true)}`}>
                      {driver.label}
                    </span>
                  </div>
                  <p className={`text-[10px] ${driver.label === 'Unknown' ? 'text-slate-500' : 'text-emerald-700'}`}>{driver.detail}</p>
                </div>
              ))}
            </div>

            {/* Negative Drivers */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                <i className="fa-solid fa-triangle-exclamation mr-1"></i> Areas to Watch
              </p>
              {result.drivers.negative.map((driver) => (
                <div 
                  key={driver.name}
                  className={`p-3 rounded-xl border ${driver.label === 'Unknown' ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-100'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${driver.label === 'Unknown' ? 'text-slate-600' : 'text-amber-800'}`}>
                      {SUB_SCORE_LABELS[driver.name]}
                    </span>
                    <span className={`text-xs font-bold ${getLabelColor(driver.label, false)}`}>
                      {driver.label}
                    </span>
                  </div>
                  <p className={`text-[10px] ${driver.label === 'Unknown' ? 'text-slate-500' : 'text-amber-700'}`}>{driver.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="pt-2 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Summary
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {generateSummary(result)}
            </p>
          </div>

          {/* Disclaimer */}
          <div className="pt-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-[9px] text-slate-500 leading-relaxed">
              <i className="fa-solid fa-circle-info mr-1"></i>
              <strong>General information only.</strong> Scenario estimate based on assumptions; not financial, legal, or tax advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
