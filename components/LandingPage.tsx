import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Suggestion {
  description: string;
  mainText: string;
  secondaryText: string;
}

interface LandingPageProps {
  address: string;
  onAddressChange: (value: string) => void;
  onSearch: (e: React.FormEvent) => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  suggestions: Suggestion[];
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  isValidAddress: boolean;
  isLocating: boolean;
  onDetectLocation: () => void;
  isMobile: boolean;
  onShowPricing: () => void;
  onOurStory?: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ 
  address,
  onAddressChange,
  onSearch,
  onSelectSuggestion,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  isValidAddress,
  isLocating,
  onDetectLocation,
  isMobile,
  onShowPricing,
  onOurStory
}) => {
  // Before/After showcase slider state
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Demo typing effect
  const triggerDemoTyping = () => {
    // Scroll to top first
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Wait for scroll to complete, then start typing
    setTimeout(() => {
      if (address) return; // Don't override if user already typed something
      
      const demoAddress = "42 Example St, Sydney NSW 2000";
      let currentIndex = 0;
      
      const typeInterval = setInterval(() => {
        if (currentIndex <= demoAddress.length) {
          onAddressChange(demoAddress.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(typeInterval);
        }
      }, 50); // 50ms per character
    }, 800); // Wait for scroll
  };

  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    handleSliderMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    handleSliderMove(e.touches[0].clientX);
  };

  // Global listeners for smooth dragging even outside the slider area
  useEffect(() => {
    const handleUp = () => { isDragging.current = false; };
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, []);

  return (
    <div className="space-y-0" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* ============================================
          HERO SECTION - Search First
          ============================================ */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0" style={{ backgroundColor: 'var(--bg-primary)' }}></div>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#C9A961]/5 rounded-full blur-3xl -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#B8C5A0]/5 rounded-full blur-3xl -ml-32 -mb-32"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#C9A961]/20">
            <i className="fa-solid fa-bolt"></i>
            <span>AI-Powered Property Intelligence</span>
          </div>
          
          <h1 className="text-[3rem] sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05]" style={{ color: 'var(--text-primary)' }}>
            Every property<br/>
            <span className="text-[#C9A961]">has a number.</span>
          </h1>
          
          <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-medium" style={{ color: 'var(--text-muted)' }}>
            Every seller has one. Every buyer has one. We're just bringing it into the open — for any <strong style={{ color: 'var(--text-primary)' }}>Australian</strong> address.
          </p>
          
          {/* SEARCH BAR */}
          <div className="max-w-2xl mx-auto pt-2">
            <form onSubmit={onSearch} className="relative group">
              <div className="absolute -inset-1 bg-[#C9A961] rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
              <div
                className="relative flex items-center p-2 rounded-[2rem] shadow-xl"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid #DCD7CE' }}
              >
                <div className="flex-grow flex items-center px-4 sm:px-6 min-w-0">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => onAddressChange(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Enter any Australian address..."
                    className="w-full py-3.5 sm:py-4 bg-transparent text-base sm:text-lg font-medium focus:outline-none"
                    style={{ color: 'var(--text-primary)' }}
                    autoComplete="off"
                    autoCapitalize="words"
                    inputMode="text"
                    enterKeyHint="search"
                  />
                  {/* Clear button - appears when address has text */}
                  {address && (
                    <button
                      type="button"
                      onClick={() => {
                        onAddressChange('');
                        setShowSuggestions(false);
                      }}
                      className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-[#4A4137]/40 hover:text-[#C9A961] transition-colors rounded-full"
                      aria-label="Clear address"
                    >
                      <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 pr-2 flex-shrink-0">
                  {isMobile && (
                    <button
                      type="button"
                      onClick={onDetectLocation}
                      disabled={isLocating}
                      className="w-11 h-11 text-[#5D8A66] hover:text-[#C9A961] transition-all disabled:opacity-50"
                      aria-label="Use my current location"
                    >
                      <i className={`fa-solid ${isLocating ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'} text-lg`}></i>
                    </button>
                  )}
                  {/* Inline submit — desktop only. Mobile gets a full-width CTA below. */}
                  <button
                    type="submit"
                    disabled={!isValidAddress}
                    className="hidden sm:inline-flex bg-[#C9A961] text-white px-8 h-12 rounded-xl font-bold hover:bg-[#3A342D] transition-all disabled:opacity-30 uppercase tracking-widest text-[10px] items-center"
                  >
                    Audit Block
                  </button>
                </div>
              </div>

              {/* Full-width submit — mobile only. */}
              <button
                type="submit"
                disabled={!isValidAddress}
                className="sm:hidden w-full mt-3 bg-[#C9A961] text-white h-12 rounded-2xl font-bold hover:bg-[#3A342D] transition-all disabled:opacity-30 uppercase tracking-widest text-[11px]"
              >
                Audit Block
              </button>
              
              {showSuggestions && suggestions.length > 0 && (
                <div
                  className="absolute left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50 ring-1 ring-black/5"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid #DCD7CE',
                    boxShadow: '0 12px 32px -8px rgba(74, 65, 55, 0.18), 0 4px 12px -4px rgba(74, 65, 55, 0.08)',
                  }}
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => onSelectSuggestion(suggestion)}
                      className="w-full px-6 py-3.5 text-left hover:bg-[#C9A961]/10 transition-colors flex items-center gap-3 border-b last:border-b-0 border-[#E8E6E3]"
                    >
                      <i className="fa-solid fa-location-dot text-[#C9A961] text-sm flex-shrink-0"></i>
                      <div className="min-w-0">
                        <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{suggestion.mainText}</p>
                        {suggestion.secondaryText && (
                          <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{suggestion.secondaryText}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>
            
            <p className="text-xs mt-4 font-medium" style={{ color: 'var(--text-muted)' }}>
              No sign-up required • Free instant report
            </p>
          </div>
        </div>
        
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <i className="fa-solid fa-chevron-down text-[#C9A961]/40 text-2xl"></i>
        </div>
      </section>

      {/* ============================================
          BEFORE/AFTER SHOWCASE — for developers & renovators
          ============================================ */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#C9A961]/5 rounded-full blur-3xl -ml-48 -mt-48"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#B8C5A0]/5 rounded-full blur-3xl -mr-48 -mb-48"></div>

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <span className="inline-block px-4 py-1.5 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
              Uplift potential
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'var(--text-primary)' }}>
              Same property.<br />
              <span className="text-[#C9A961]">Different outcome.</span>
            </h2>
            <p className="max-w-xl mx-auto text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
              Buy as-is, or buy with a plan. Your report tells you which strategies fit — and what each one's worth.
            </p>
          </div>

          <div className="relative max-w-5xl mx-auto">
            <div
              ref={sliderRef}
              className="relative aspect-[16/10] sm:aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden cursor-col-resize select-none shadow-2xl"
              onMouseDown={() => { isDragging.current = true; }}
              onTouchStart={() => { isDragging.current = true; }}
              onMouseMove={handleMouseMove}
              onTouchMove={handleTouchMove}
            >
              <img
                src="/Reno-2.png"
                alt="Renovated property"
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <img
                  src="/Reno-1.png"
                  alt="Original property"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>

              <div
                className="absolute top-0 bottom-0 w-1 shadow-2xl z-10"
                style={{ backgroundColor: 'var(--bg-card)', left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-2xl flex items-center justify-center border-4 border-[#C9A961]" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <i className="fa-solid fa-arrows-left-right text-[#C9A961] text-base sm:text-lg"></i>
                </div>
              </div>

              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                Before
              </div>
              <div className="absolute bottom-4 right-4 bg-[#C9A961] text-white text-xs font-bold px-3 py-1.5 rounded-full">
                After
              </div>
            </div>

            <div className="text-center mt-4">
              <span className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-full" style={{ color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-hand-pointer text-[#C9A961]"></i>
                Drag slider to compare
              </span>
            </div>
          </div>

          <p className="text-center text-xs mt-6 italic" style={{ color: 'var(--text-muted)' }}>
            Indicative only. Your numbers depend on suburb, scope, and timing.
          </p>
        </div>
      </section>

      {/* ============================================
          WHY WE BUILT THIS — story teaser
          ============================================ */}
      <section className="py-20 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block px-3 py-1 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-5">
            Why we built this
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#3A342D] mb-6 leading-[1.15]">
            We were sick of guessing.
          </h2>
          <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
            Two years of open homes. Listings underquoted by half a million. The same answer from every agent: <em>"Make an offer."</em>
          </p>
          <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
            Every seller has a number. Every buyer has a number. The system just hides it.
          </p>
          <p className="text-base sm:text-lg text-[#3A342D] font-bold leading-relaxed mb-8">
            So we built a way to bring it into the open.
          </p>
          {onOurStory && (
            <button
              onClick={onOurStory}
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#C9A961] hover:text-[#3A342D] transition-colors"
            >
              Read the full story
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          )}
        </div>
      </section>

      {/* ============================================
          SAMPLE REPORT PREVIEW
          ============================================ */}
      <section className="py-20 px-6 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
              <i className="fa-solid fa-file-pdf mr-2"></i>
              Sample Report
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
              What you actually get.
            </h2>
            <p className="max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
              Estimated value, comparables, zoning, uplift strategies, dual-occupancy and dev scenarios — for any Australian address.
            </p>
          </div>
          
          {/* Mock Report Preview - Matching PDF Style */}
          <div className="relative max-w-4xl mx-auto">
            {/* Background cards for depth */}
            <div className="absolute top-6 left-4 right-4 h-full rounded-[2rem] opacity-40" style={{ backgroundColor: 'var(--bg-secondary)' }}></div>
            <div className="absolute top-3 left-2 right-2 h-full rounded-[2rem] opacity-60" style={{ backgroundColor: 'var(--bg-secondary)' }}></div>
            
            {/* Main Report Card */}
            <div className="relative rounded-[2rem] sm:rounded-[3rem] shadow-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              {/* Report Header */}
              <div className="p-6 sm:p-10 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Property Strategy Guide
                  </div>
                  <div className="flex gap-4 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
                    <span><i className="fa-solid fa-bed text-[#C9A961] mr-1.5"></i> 3</span>
                    <span><i className="fa-solid fa-bath text-[#C9A961] mr-1.5"></i> 2</span>
                    <span><i className="fa-solid fa-car text-[#C9A961] mr-1.5"></i> 2</span>
                  </div>
                </div>
                
                <h3 className="text-2xl sm:text-4xl font-bold tracking-tighter leading-tight mb-2 font-address" style={{ color: 'var(--text-primary)' }}>
                  42 Example St, Sydney NSW 2000
                </h3>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>House • Land • 680 m²</p>
              </div>
              
              {/* Uplift Strategies Preview */}
              <div className="p-6 sm:p-10 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-hammer text-[#B8C5A0] mr-2"></i>
                  Uplift & Value-Add Strategies
                </h4>
                
                {/* Strategy Card 1 */}
                <div className="p-5 rounded-2xl border transition-all" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-bold" style={{ color: 'var(--text-primary)' }}>Cosmetic Renovation</h5>
                        <span className="px-2 py-0.5 bg-[#B8C5A0]/10 text-[#B8C5A0] rounded text-[9px] font-bold uppercase">Low Effort</span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Kitchen update, bathroom refresh, new flooring throughout</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Potential Uplift</p>
                      <p className="font-black text-[#B8C5A0]">$150K – $200K</p>
                    </div>
                  </div>
                </div>
                
                {/* Strategy Card 2 */}
                <div className="p-5 rounded-2xl border transition-all" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-bold" style={{ color: 'var(--text-primary)' }}>Dual Occupancy</h5>
                        <span className="px-2 py-0.5 bg-[#C9A961]/10 text-[#C9A961] rounded text-[9px] font-bold uppercase">High Effort</span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Subdivide and construct second dwelling at rear</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Indicative Net Profit</p>
                      <p className="font-black text-[#C9A961]">$400K – $600K</p>
                    </div>
                  </div>
                </div>
                
                {/* Zoning Badge */}
                <div className="flex items-center gap-4 p-4 rounded-xl mt-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--text-primary)' }}>
                    <span className="font-black text-sm" style={{ color: 'var(--bg-primary)' }}>R2</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Low Density Residential</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Dual occupancy permitted • 680m² exceeds minimum lot size</p>
                  </div>
                </div>
              </div>
              
              {/* Fade overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none" style={{ background: 'linear-gradient(to top, var(--bg-card), transparent)' }}></div>
            </div>
          </div>
          
          {/* CTA */}
          <div className="text-center mt-10">
            <button
              onClick={triggerDemoTyping}
              className="group bg-[#3A342D] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#C9A961] transition-all inline-flex items-center gap-3 shadow-lg text-sm uppercase tracking-wider"
            >
              <span>Generate Your Report</span>
              <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
            </button>
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>30 second analysis • No credit card required</p>
          </div>
        </div>
      </section>

      {/* ============================================
          WHO IS THIS FOR — two-lane marketplace split
          ============================================ */}
      <section className="py-20 sm:py-24 px-4 sm:px-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
              Two sides
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Who's it for?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* HOME OWNERS */}
            <div
              className="p-8 sm:p-10 rounded-3xl"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid #DCD7CE',
                boxShadow: '0 8px 24px -8px rgba(74, 65, 55, 0.06)',
              }}
            >
              <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
                Free
              </span>
              <h3 className="text-2xl font-bold tracking-tight text-[#3A342D] mb-2">Home owners</h3>
              <p className="text-sm text-[#4A4137]/60 mb-6">For people trying to figure out what their place is actually worth.</p>
              <ul className="space-y-3 text-sm text-[#4A4137]/80 mb-8">
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-[#C9A961] mt-1 flex-shrink-0"></i>
                  <span>Unlimited free property reports</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-[#C9A961] mt-1 flex-shrink-0"></i>
                  <span>Reno, dual-occ, and development scenarios</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-[#C9A961] mt-1 flex-shrink-0"></i>
                  <span>Indicate you're open to conversations when ready</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-[#C9A961] mt-1 flex-shrink-0"></i>
                  <span>No sign-up to start. No credit card.</span>
                </li>
              </ul>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-full bg-[#3A342D] text-white h-12 rounded-xl font-bold hover:bg-[#C9A961] transition-colors uppercase tracking-widest text-[10px]"
              >
                Search a property
              </button>
            </div>

            {/* DEVELOPERS & BUYERS AGENTS */}
            <div
              className="p-8 sm:p-10 rounded-3xl relative"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid #C9A961',
                boxShadow: '0 8px 24px -8px rgba(201, 169, 97, 0.18)',
              }}
            >
              <span className="inline-block px-3 py-1 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
                $49 per lead
              </span>
              <h3 className="text-2xl font-bold tracking-tight text-[#3A342D] mb-2">Developers & buyers agents</h3>
              <p className="text-sm text-[#4A4137]/60 mb-6">For people sourcing properties — not just hunting for one.</p>
              <ul className="space-y-3 text-sm text-[#4A4137]/80 mb-8">
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-[#C9A961] mt-1 flex-shrink-0"></i>
                  <span>Browse owners open to a conversation</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-[#C9A961] mt-1 flex-shrink-0"></i>
                  <span>5 free lead reveals to start</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-[#C9A961] mt-1 flex-shrink-0"></i>
                  <span>Full address + seller contact on reveal</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fa-solid fa-check text-[#C9A961] mt-1 flex-shrink-0"></i>
                  <span>Per-lead pricing. No subscription lock-in.</span>
                </li>
              </ul>
              <button
                onClick={onShowPricing}
                className="w-full bg-[#C9A961] text-white h-12 rounded-xl font-bold hover:bg-[#3A342D] transition-colors uppercase tracking-widest text-[10px]"
              >
                See how it works
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          FINAL CTA + FOOTER
          ============================================ */}
      <footer className="mt-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Divider line above CTA */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="border-t" style={{ borderColor: 'var(--border-color)' }}></div>
        </div>
        
        {/* CTA Section */}
        <div className="py-16 px-6 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Stop guessing.
            </h2>
            <p className="text-base sm:text-lg" style={{ color: 'var(--text-muted)' }}>
              Type any Australian address. See what it's actually worth — and what it could be.
            </p>
            <button
              onClick={triggerDemoTyping}
              className="group bg-[#C9A961] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#3A342D] transition-all inline-flex items-center gap-3 shadow-lg text-sm uppercase tracking-wider"
            >
              <span>Search an address</span>
              <i className="fa-solid fa-arrow-up group-hover:-translate-y-1 transition-transform"></i>
            </button>
          </div>
        </div>
        
        {/* Disclaimer block — below CTA, above the global footer */}
        <div className="px-6 pb-12 pt-4">
          <p className="text-[10px] text-center max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            upblock.ai is an introduction platform. We are not a real estate agent and do not facilitate
            contracts of sale. All reports are AI-generated estimates for research purposes only —
            not financial, legal, or planning advice. Verify independently before any transaction.
            Property owners and buyers must obtain their own legal and financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
