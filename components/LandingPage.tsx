import React from 'react';

interface LandingPageProps {
  onScrollToSearch: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onScrollToSearch }) => {
  return (
    <div className="space-y-0">
      {/* ============================================
          HERO SECTION - Above the fold
          ============================================ */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F6] via-[#FAF9F6] to-white"></div>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#C9A961]/5 rounded-full blur-3xl -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#B8C5A0]/5 rounded-full blur-3xl -ml-32 -mb-32"></div>
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#C9A961]/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C9A961] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C9A961]"></span>
            </span>
            <span>Trusted by 2,000+ Aussie Property Researchers</span>
          </div>
          
          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05] text-[#3A342D]">
            Research Any Property<br/>
            <span className="text-[#C9A961]">In Under 60 Seconds</span>
          </h1>
          
          {/* Subheadline */}
          <p className="text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed text-[#6B6560] font-medium">
            Indicative values, comparable sales, zoning intel, and uplift scenarios for any <strong className="text-[#3A342D]">Australian</strong> address. AI-assisted insights to inform your property decisions.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onScrollToSearch}
              className="group bg-[#C9A961] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#3A342D] transition-all flex items-center gap-3 shadow-lg shadow-[#C9A961]/20 text-sm uppercase tracking-widest"
            >
              <span>Get Free Report</span>
              <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
            </button>
            <p className="text-xs text-[#9B9590] font-medium">
              No sign-up required • Instant results
            </p>
          </div>
          
          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-xs text-[#9B9590] font-medium">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-shield-check text-[#B8C5A0]"></i>
              <span>Privacy-first</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-database text-[#B8C5A0]"></i>
              <span>Multiple data sources</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-bolt text-[#B8C5A0]"></i>
              <span>AI-powered analysis</span>
            </div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <i className="fa-solid fa-chevron-down text-[#C9A961]/40 text-2xl"></i>
        </div>
      </section>

      {/* ============================================
          SAMPLE REPORT PREVIEW
          ============================================ */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1 bg-[#B8C5A0]/10 text-[#B8C5A0] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
              Sample Report
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#3A342D] tracking-tight mb-4">
              See What You'll Get
            </h2>
            <p className="text-[#6B6560] max-w-xl mx-auto">
              Comprehensive property intelligence at your fingertips
            </p>
          </div>
          
          {/* Mock Report Card */}
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute -inset-4 bg-gradient-to-r from-[#C9A961]/10 via-[#B8C5A0]/10 to-[#C9A961]/10 rounded-[3rem] blur-2xl"></div>
            <div className="relative bg-[#FAF9F6] rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-[#E8E6E3]">
              {/* Report Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <span className="px-4 py-2 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Property Strategy Guide
                  </span>
                  <span className="text-[#9B9590] text-sm flex items-center gap-2">
                    <i className="fa-solid fa-file-pdf"></i>
                    Export PDF
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[#9B9590] text-sm">
                  <span><i className="fa-solid fa-bed mr-1"></i> 3</span>
                  <span><i className="fa-solid fa-bath mr-1"></i> 1</span>
                  <span><i className="fa-solid fa-car mr-1"></i> 1</span>
                </div>
              </div>
              
              {/* Address */}
              <h3 className="text-3xl sm:text-4xl font-bold text-[#3A342D] tracking-tight mb-2">
                42 Example St, Sydney NSW 2000
              </h3>
              <p className="text-[#6B6560] mb-8">House • Land • 680 m²</p>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-[9px] font-bold text-[#9B9590] uppercase tracking-widest mb-1">Estimated Value</p>
                  <p className="text-2xl font-black text-[#B8C5A0]">$1.2M</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-[#9B9590] uppercase tracking-widest mb-1">Post-Improvements</p>
                  <p className="text-2xl font-black text-[#C9A961]">$1.4M – $1.5M</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-[#9B9590] uppercase tracking-widest mb-1">Growth (12mo)</p>
                  <p className="text-2xl font-black text-[#3A342D]">4.2%</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-[#9B9590] uppercase tracking-widest mb-1">Data Confidence</p>
                  <p className="text-2xl font-black text-[#B8C5A0] flex items-center gap-2">
                    High
                    <span className="w-6 h-6 bg-[#B8C5A0]/20 rounded-full flex items-center justify-center">
                      <i className="fa-solid fa-check text-[#B8C5A0] text-xs"></i>
                    </span>
                  </p>
                </div>
              </div>
              
              {/* Upblock Score */}
              <div className="absolute top-8 right-8 md:top-12 md:right-12">
                <div className="bg-white rounded-2xl px-4 py-2 shadow-lg border border-[#E8E6E3] flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[#9B9590] uppercase tracking-wider">Upblock Score</span>
                  <span className="text-2xl font-black text-[#C9A961]">76<span className="text-sm text-[#9B9590] font-medium">/100</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          AI VISUALIZER SHOWCASE
          ============================================ */}
      <section className="py-20 px-6 bg-gradient-to-b from-white to-[#FAF9F6]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="inline-block px-4 py-1 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest">
                AI Renovation Visualizer
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#3A342D] tracking-tight">
                Picture the Potential
              </h2>
              <p className="text-[#6B6560] leading-relaxed">
                Upload a photo of any property and see AI-generated renovation scenarios in seconds. Explore facade makeovers, interior updates, and development possibilities.
              </p>
              <ul className="space-y-3">
                {[
                  'Kitchen & bathroom renovations',
                  'Facade and exterior updates',
                  'Development scenarios (duplex, townhouses)',
                  'Landscaping transformations'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[#3A342D]">
                    <span className="w-5 h-5 bg-[#C9A961]/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-check text-[#C9A961] text-[10px]"></i>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={onScrollToSearch}
                className="inline-flex items-center gap-2 text-[#C9A961] font-bold hover:gap-3 transition-all"
              >
                Try it now <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
            
            {/* Visual mockup */}
            <div className="relative">
              <div className="absolute -inset-4 bg-[#3A342D] rounded-[2rem] blur-2xl opacity-10"></div>
              <div className="relative bg-[#3A342D] rounded-[2rem] p-4 shadow-2xl">
                <div className="aspect-video bg-gradient-to-br from-[#5D544A] to-[#3A342D] rounded-xl flex items-center justify-center relative overflow-hidden">
                  {/* Before side */}
                  <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-[#6B6560]/30 flex items-center justify-center">
                    <span className="text-white/40 text-sm font-medium">Before</span>
                  </div>
                  {/* After side */}
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[#C9A961]/20 flex items-center justify-center">
                    <span className="text-white/60 text-sm font-medium">After</span>
                  </div>
                  {/* Slider */}
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/80 z-10"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center z-20">
                    <i className="fa-solid fa-arrows-left-right text-[#C9A961] text-sm"></i>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <span className="inline-flex items-center gap-2 text-white/60 text-xs">
                    <i className="fa-solid fa-hand-pointer text-[#C9A961]"></i>
                    Drag to compare
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          RISK ALERTS / THINGS TO WATCH
          ============================================ */}
      <section className="py-20 px-6 bg-[#FAF9F6]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Visual */}
            <div className="order-2 md:order-1">
              <div className="bg-[#FDF2F2] rounded-[2rem] p-8 border border-[#FECACA]/30">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-[#EF4444] rounded-xl flex items-center justify-center">
                    <i className="fa-solid fa-eye text-white"></i>
                  </div>
                  <h4 className="text-xl font-bold text-[#3A342D]">Things to Watch Out For</h4>
                </div>
                <div className="space-y-4">
                  {[
                    { title: 'Heritage Controls', desc: 'Properties in this area often have heritage overlays. Confirm with council.' },
                    { title: 'Easement Restrictions', desc: 'Check for sewer lines or easements that may restrict building.' },
                    { title: 'Flood Zone', desc: 'Parts of this suburb are in a flood planning area.' }
                  ].map((item, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 border border-[#FECACA]/20">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-[#3B82F6]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <i className="fa-solid fa-info text-[#3B82F6] text-[10px]"></i>
                        </div>
                        <div>
                          <h5 className="font-bold text-[#3A342D] text-sm">{item.title}</h5>
                          <p className="text-[#6B6560] text-xs mt-1">{item.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="order-1 md:order-2 space-y-6">
              <span className="inline-block px-4 py-1 bg-[#EF4444]/10 text-[#EF4444] rounded-full text-[10px] font-bold uppercase tracking-widest">
                Due Diligence
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#3A342D] tracking-tight">
                Key Considerations<br/>Before You Decide
              </h2>
              <p className="text-[#6B6560] leading-relaxed">
                Every report highlights potential issues worth investigating — heritage overlays, easements, flood zones, bushfire risk, and more. Research smarter, not harder.
              </p>
              <button
                onClick={onScrollToSearch}
                className="inline-flex items-center gap-2 text-[#EF4444] font-bold hover:gap-3 transition-all"
              >
                Check an address <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          FEATURES GRID
          ============================================ */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1 bg-[#B8C5A0]/10 text-[#B8C5A0] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
              What's Included
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#3A342D] tracking-tight mb-4">
              Everything You Need to Research
            </h2>
            <p className="text-[#6B6560] max-w-xl mx-auto">
              Comprehensive property intelligence in one report
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: 'fa-dollar-sign', title: 'Indicative Value Range', desc: 'AI-estimated value based on comparable sales and market data', color: '#B8C5A0' },
              { icon: 'fa-chart-line', title: 'Comparable Sales', desc: 'Recent nearby sales to inform your research', color: '#C9A961' },
              { icon: 'fa-map', title: 'Zoning & Planning', desc: 'Local planning controls, overlays, and development potential', color: '#3B82F6' },
              { icon: 'fa-hammer', title: 'Uplift Strategies', desc: 'Renovation and improvement scenarios with cost estimates', color: '#8B5CF6' },
              { icon: 'fa-city', title: 'Development Scenarios', desc: 'Subdivision, duplex, and multi-dwelling possibilities', color: '#EC4899' },
              { icon: 'fa-eye', title: 'Risk Considerations', desc: 'Heritage, easements, flood zones, and other factors', color: '#EF4444' },
              { icon: 'fa-school', title: 'Local Amenities', desc: 'Schools, transport, shops, and community facilities', color: '#10B981' },
              { icon: 'fa-wand-magic-sparkles', title: 'AI Visualizer', desc: 'See renovation potential with AI-generated images', color: '#F59E0B' },
              { icon: 'fa-file-pdf', title: 'PDF Export', desc: 'Download professional reports to share', color: '#6B7280' },
            ].map((feature, i) => (
              <div key={i} className="group p-6 rounded-2xl border border-[#E8E6E3] hover:border-[#C9A961]/30 hover:shadow-lg transition-all bg-[#FAF9F6]/50">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${feature.color}15` }}
                >
                  <i className={`fa-solid ${feature.icon}`} style={{ color: feature.color }}></i>
                </div>
                <h3 className="font-bold text-[#3A342D] mb-2">{feature.title}</h3>
                <p className="text-sm text-[#6B6560]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          HOW IT WORKS
          ============================================ */}
      <section className="py-20 px-6 bg-gradient-to-b from-white to-[#FAF9F6]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#3A342D] tracking-tight mb-4">
              Three Simple Steps
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: '1', title: 'Enter an Address', desc: 'Type any Australian street address into the search bar', icon: 'fa-location-dot' },
              { num: '2', title: 'AI Analyses Data', desc: 'We aggregate data from multiple sources in seconds', icon: 'fa-microchip' },
              { num: '3', title: 'Get Your Report', desc: 'Review comprehensive insights and export as PDF', icon: 'fa-file-chart-column' },
            ].map((step, i) => (
              <div key={i} className="text-center space-y-4">
                <div className="relative inline-block">
                  <div className="w-16 h-16 bg-[#C9A961]/10 rounded-2xl flex items-center justify-center mx-auto">
                    <i className={`fa-solid ${step.icon} text-2xl text-[#C9A961]`}></i>
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-[#C9A961] rounded-full text-white text-xs font-bold flex items-center justify-center">
                    {step.num}
                  </span>
                </div>
                <h3 className="font-bold text-[#3A342D] text-lg">{step.title}</h3>
                <p className="text-sm text-[#6B6560]">{step.desc}</p>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <button
              onClick={onScrollToSearch}
              className="group bg-[#3A342D] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#C9A961] transition-all flex items-center gap-3 shadow-lg mx-auto text-sm uppercase tracking-widest"
            >
              <span>Try It Now — Free</span>
              <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
            </button>
          </div>
        </div>
      </section>

      {/* ============================================
          FINAL CTA
          ============================================ */}
      <section className="py-20 px-6 bg-[#3A342D]">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
            Stop Guessing.<br/>
            <span className="text-[#C9A961]">Start Researching.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            Join thousands of Australians using AI-powered insights to inform their property decisions.
          </p>
          <button
            onClick={onScrollToSearch}
            className="group bg-[#C9A961] text-[#3A342D] px-10 py-5 rounded-2xl font-bold hover:bg-white transition-all flex items-center gap-3 shadow-lg mx-auto text-sm uppercase tracking-widest"
          >
            <span>Get Your Free Report</span>
            <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
          </button>
          <p className="text-xs text-white/40">
            For research purposes only. Not financial advice. Indicative estimates only.
          </p>
        </div>
      </section>

      {/* ============================================
          FOOTER
          ============================================ */}
      <footer className="py-12 px-6 bg-[#2D2A26] border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/upblock.ai-logo.png" alt="upblock.ai" className="h-8" />
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Use</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            
            <p className="text-xs text-white/30">
              © {new Date().getFullYear()} upblock.ai • AI-powered property intelligence
            </p>
          </div>
          
          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-[10px] text-white/20 max-w-2xl mx-auto leading-relaxed">
              Disclaimer: upblock.ai provides indicative property information for research purposes only. 
              This is not financial, legal, or professional advice. All estimates are AI-generated and should be 
              verified independently. Always consult qualified professionals before making property decisions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

