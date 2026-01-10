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
  onShowPricing
}) => {
  // Before/After slider state
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
    <div className="space-y-0">
      {/* ============================================
          HERO SECTION - Search First
          ============================================ */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 bg-white"></div>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#C9A961]/5 rounded-full blur-3xl -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#B8C5A0]/5 rounded-full blur-3xl -ml-32 -mb-32"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#C9A961]/20">
            <i className="fa-solid fa-bolt"></i>
            <span>AI-Powered Property Intelligence</span>
          </div>
          
          <h1 className="text-[3rem] sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05] text-[#3A342D]">
            Discover Hidden Equity<br/>
            <span className="text-[#C9A961]">In Any Property</span>
          </h1>
          
          <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-[#6B6560] font-medium">
            Uncover value-add potential, comparable sales, and planning insights for any <strong className="text-[#3A342D]">Australian</strong> address — powered by AI.
          </p>
          
          {/* SEARCH BAR */}
          <div className="max-w-2xl mx-auto pt-2">
            <form onSubmit={onSearch} className="relative group">
              <div className="absolute -inset-1 bg-[#C9A961] rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
              <div className="relative flex items-center p-2 rounded-[2rem] shadow-xl border bg-white border-[#E8E6E3]">
                <div className="flex-grow flex items-center px-6">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => onAddressChange(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Enter any Australian address..."
                    className="w-full py-3 sm:py-4 bg-transparent text-base sm:text-lg font-medium focus:outline-none text-[#3A342D] placeholder:text-[#9B9590]"
                    autoComplete="off"
                  />
                </div>
                <div className="flex items-center gap-2 pr-2">
                  {isMobile && (
                    <button
                      type="button"
                      onClick={onDetectLocation}
                      disabled={isLocating}
                      className="w-12 h-12 text-[#B8C5A0] hover:text-[#C9A961] transition-all disabled:opacity-50"
                    >
                      <i className={`fa-solid ${isLocating ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`}></i>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!isValidAddress}
                    className="bg-[#C9A961] text-white px-6 sm:px-8 h-11 sm:h-12 rounded-xl font-bold hover:bg-[#3A342D] transition-all disabled:opacity-30 uppercase tracking-widest text-[11px] sm:text-[10px]"
                  >
                    Audit Block
                  </button>
                </div>
              </div>
              
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 rounded-2xl shadow-xl border overflow-hidden z-50 bg-white border-[#E8E6E3]">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => onSelectSuggestion(suggestion)}
                      className="w-full px-6 py-3 text-left hover:bg-[#C9A961]/10 transition-colors flex items-center gap-3 border-b last:border-b-0 border-[#E8E6E3]"
                    >
                      <i className="fa-solid fa-location-dot text-[#C9A961] text-sm flex-shrink-0"></i>
                      <div className="min-w-0">
                        <p className="font-medium truncate text-[#3A342D]">{suggestion.mainText}</p>
                        {suggestion.secondaryText && (
                          <p className="text-sm truncate text-[#9B9590]">{suggestion.secondaryText}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </form>
            
            <p className="text-xs text-[#9B9590] mt-4 font-medium">
              No sign-up required • Free instant report
            </p>
          </div>
        </div>
        
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <i className="fa-solid fa-chevron-down text-[#C9A961]/40 text-2xl"></i>
        </div>
      </section>

      {/* ============================================
          AI VISUALIZER - BIG SHOWCASE
          ============================================ */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white relative overflow-hidden">
        {/* Background accents */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#C9A961]/5 rounded-full blur-3xl -ml-48 -mt-48"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#B8C5A0]/5 rounded-full blur-3xl -mr-48 -mb-48"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10 sm:mb-12">
            <span className="inline-block px-4 py-1.5 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
              <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
              AI Property Visualizer
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#3A342D] tracking-tight mb-4">
              Picture the Potential
            </h2>
            <p className="text-[#6B6560] max-w-xl mx-auto text-sm sm:text-base">
              Drag the slider to see AI-generated transformations — from cosmetic renovations to full development builds
            </p>
          </div>
          
          {/* BIG Slider */}
          <div className="relative max-w-5xl mx-auto">
            <div 
              ref={sliderRef}
              className="relative aspect-[16/10] sm:aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden cursor-col-resize select-none shadow-2xl"
              onMouseDown={() => { isDragging.current = true; }}
              onTouchStart={() => { isDragging.current = true; }}
              onMouseMove={handleMouseMove}
              onTouchMove={handleTouchMove}
            >
              {/* After Image (Background) */}
              <img 
                src="/Reno-2.png" 
                alt="AI visualized renovation"
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              {/* Before Image (Clipped) */}
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
              
              {/* Slider Line */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl z-10"
                style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-[#C9A961]">
                  <i className="fa-solid fa-arrows-left-right text-[#C9A961] text-base sm:text-lg"></i>
                </div>
              </div>
              
              {/* Labels */}
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                Before
              </div>
              <div className="absolute bottom-4 right-4 bg-[#C9A961] text-white text-xs font-bold px-3 py-1.5 rounded-full">
                After
              </div>
            </div>
            
            {/* Drag hint */}
            <div className="text-center mt-4">
              <span className="inline-flex items-center gap-2 text-[#6B6560] text-sm px-5 py-2.5 rounded-full">
                <i className="fa-solid fa-hand-pointer text-[#C9A961]"></i>
                Drag slider to compare
              </span>
            </div>
          </div>
          
          {/* Feature bullets */}
          <div className="flex flex-wrap justify-center gap-6 mt-6 text-sm text-[#6B6560]">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-check text-[#C9A961]"></i>
              <span>Upload any photo</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-check text-[#C9A961]"></i>
              <span>Results in seconds</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-check text-[#C9A961]"></i>
              <span>Download & share</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          SAMPLE REPORT PREVIEW
          ============================================ */}
      <section className="py-20 px-6 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
              <i className="fa-solid fa-file-pdf mr-2"></i>
              Sample Report
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#3A342D] tracking-tight mb-3">
              Your Complete Property Intelligence
            </h2>
            <p className="text-[#6B6560] max-w-xl mx-auto">
              Every report includes AI-powered insights, development potential, and actionable strategies
            </p>
          </div>
          
          {/* Mock Report Preview - Matching PDF Style */}
          <div className="relative max-w-4xl mx-auto">
            {/* Background cards for depth */}
            <div className="absolute top-6 left-4 right-4 h-full bg-[#E8E6E3] rounded-[2rem] opacity-40"></div>
            <div className="absolute top-3 left-2 right-2 h-full bg-[#E8E6E3] rounded-[2rem] opacity-60"></div>
            
            {/* Main Report Card */}
            <div className="relative bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-[#E8E6E3] overflow-hidden">
              {/* Report Header */}
              <div className="p-6 sm:p-10 border-b border-[#E8E6E3]">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Property Strategy Guide
                  </div>
                  <div className="flex gap-4 text-[#6B6560] text-sm font-bold">
                    <span><i className="fa-solid fa-bed text-[#C9A961] mr-1.5"></i> 3</span>
                    <span><i className="fa-solid fa-bath text-[#C9A961] mr-1.5"></i> 2</span>
                    <span><i className="fa-solid fa-car text-[#C9A961] mr-1.5"></i> 2</span>
                  </div>
                </div>
                
                <h3 className="text-2xl sm:text-4xl font-bold text-[#3A342D] tracking-tighter leading-tight mb-2 font-address">
                  42 Example St, Sydney NSW 2000
                </h3>
                <p className="text-[#6B6560] text-sm font-medium">House • Land • 680 m²</p>
              </div>
              
              {/* Uplift Strategies Preview */}
              <div className="p-6 sm:p-10 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#9B9590] mb-4">
                  <i className="fa-solid fa-hammer text-[#B8C5A0] mr-2"></i>
                  Uplift & Value-Add Strategies
                </h4>
                
                {/* Strategy Card 1 */}
                <div className="p-5 rounded-2xl border border-[#E8E6E3] hover:border-[#C9A961]/30 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-bold text-[#3A342D]">Cosmetic Renovation</h5>
                        <span className="px-2 py-0.5 bg-[#B8C5A0]/10 text-[#B8C5A0] rounded text-[9px] font-bold uppercase">Low Effort</span>
                      </div>
                      <p className="text-[#6B6560] text-xs">Kitchen update, bathroom refresh, new flooring throughout</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[9px] text-[#9B9590] uppercase tracking-wider">Potential Uplift</p>
                      <p className="font-black text-[#B8C5A0]">$150K – $200K</p>
                    </div>
                  </div>
                </div>
                
                {/* Strategy Card 2 */}
                <div className="p-5 rounded-2xl border border-[#E8E6E3] hover:border-[#C9A961]/30 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-bold text-[#3A342D]">Dual Occupancy</h5>
                        <span className="px-2 py-0.5 bg-[#C9A961]/10 text-[#C9A961] rounded text-[9px] font-bold uppercase">High Effort</span>
                      </div>
                      <p className="text-[#6B6560] text-xs">Subdivide and construct second dwelling at rear</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[9px] text-[#9B9590] uppercase tracking-wider">Indicative Net Profit</p>
                      <p className="font-black text-[#C9A961]">$400K – $600K</p>
                    </div>
                  </div>
                </div>
                
                {/* Zoning Badge */}
                <div className="flex items-center gap-4 p-4 bg-[#F5F5F5] rounded-xl mt-6">
                  <div className="w-12 h-12 bg-[#3A342D] rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-black text-sm">R2</span>
                  </div>
                  <div>
                    <p className="font-bold text-[#3A342D] text-sm">Low Density Residential</p>
                    <p className="text-[#6B6560] text-xs">Dual occupancy permitted • 680m² exceeds minimum lot size</p>
                  </div>
                </div>
              </div>
              
              {/* Fade overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
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
            <p className="text-xs text-[#9B9590] mt-3">30 second analysis • No credit card required</p>
          </div>
        </div>
      </section>

      {/* ============================================
          FEATURES GRID - Condensed
          ============================================ */}
      <section className="py-20 px-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ color: 'var(--text-primary)' }}>
              Everything in One Report
            </h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: 'fa-dollar-sign', title: 'Value Estimates', color: '#B8C5A0' },
              { icon: 'fa-chart-line', title: 'Comparable Sales', color: '#C9A961' },
              { icon: 'fa-map', title: 'Zoning & Planning', color: '#3B82F6' },
              { icon: 'fa-hammer', title: 'Uplift Strategies', color: '#8B5CF6' },
              { icon: 'fa-city', title: 'Development Options', color: '#EC4899' },
              { icon: 'fa-eye', title: 'Risk Alerts', color: '#EF4444' },
            ].map((feature, i) => (
              <div 
                key={i} 
                className="flex items-center gap-4 p-4 sm:p-5 rounded-2xl border hover:shadow-md transition-all"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
              >
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${feature.color}20` }}
                >
                  <i className={`fa-solid ${feature.icon} text-sm sm:text-base`} style={{ color: feature.color }}></i>
                </div>
                <span className="font-bold text-sm sm:text-base" style={{ color: 'var(--text-primary)' }}>{feature.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          HOW IT WORKS - Simple
          ============================================ */}
      <section className="py-20 px-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              How It Works
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: '1', title: 'Enter Address', desc: 'Type any Australian address', icon: 'fa-location-dot' },
              { num: '2', title: 'AI Analysis', desc: 'We process multiple data sources', icon: 'fa-microchip' },
              { num: '3', title: 'Get Report', desc: 'Instant insights, exportable PDF', icon: 'fa-file-chart-column' },
            ].map((step, i) => (
              <div key={i} className="text-center space-y-4">
                <div className="relative inline-block">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg border"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                  >
                    <i className={`fa-solid ${step.icon} text-2xl text-[#C9A961]`}></i>
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 bg-[#C9A961] rounded-full text-white text-xs font-bold flex items-center justify-center shadow-md">
                    {step.num}
                  </span>
                </div>
                <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{step.title}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          FINAL CTA + FOOTER
          ============================================ */}
      <footer className="bg-white mt-20 border-t border-[#E8E6E3]">
        {/* CTA Section */}
        <div className="py-16 px-6 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#3A342D] tracking-tight">
              Ready to Discover <span className="text-[#C9A961]">Hidden Potential?</span>
            </h2>
            <button
              onClick={triggerDemoTyping}
              className="group bg-[#C9A961] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#3A342D] transition-all inline-flex items-center gap-3 shadow-lg text-sm uppercase tracking-wider"
            >
              <span>Search an Address</span>
              <i className="fa-solid fa-arrow-up group-hover:-translate-y-1 transition-transform"></i>
            </button>
          </div>
        </div>
        
        {/* Footer Links */}
        <div className="pt-10 px-6 border-t border-[#E8E6E3]">
          <div className="max-w-6xl mx-auto flex flex-col items-center gap-6">
            <img src="/upblock.ai-logo.png" alt="upblock.ai" className="h-16 sm:h-20" />
            <div className="flex items-center gap-6 text-sm text-[#6B6560]">
              <a href="#" className="hover:text-[#3A342D] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[#3A342D] transition-colors">Terms</a>
              <span>© {new Date().getFullYear()} upblock.ai</span>
            </div>
          </div>
        </div>
        {/* Disclaimer at absolute bottom */}
        <div className="pb-4 pt-8 px-6">
          <p className="text-[10px] text-[#9B9590] text-center max-w-2xl mx-auto">
            For research purposes only. Not financial, legal, or professional advice. All estimates are AI-generated and should be verified independently.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
