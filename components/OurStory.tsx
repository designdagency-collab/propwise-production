import React from 'react';

interface OurStoryProps {
  onBack: () => void;
  onSearch?: () => void;
}

const ImagePlaceholder: React.FC<{ label: string; aspectRatio?: string }> = ({ label, aspectRatio = '16/9' }) => (
  <div
    className="rounded-2xl flex items-center justify-center"
    style={{
      aspectRatio,
      backgroundColor: '#F0EDE5',
      border: '2px dashed #DCD7CE',
    }}
  >
    <div className="text-center px-6">
      <i className="fa-regular fa-image text-3xl text-[#4A4137]/30 mb-3"></i>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A4137]/50 mb-1">
        Photo placeholder
      </p>
      <p className="text-xs text-[#4A4137]/40 italic max-w-xs mx-auto">
        {label}
      </p>
    </div>
  </div>
);

const OurStory: React.FC<OurStoryProps> = ({ onBack, onSearch }) => {
  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-4">
        <button
          onClick={onBack}
          className="text-sm font-bold uppercase tracking-widest text-[#4A4137]/60 hover:text-[#C9A961] transition-colors"
        >
          <i className="fa-solid fa-arrow-left mr-2"></i>Back
        </button>
      </div>

      <article className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Hook */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter text-[#3A342D] leading-[0.95] mt-12 mb-12">
          We were sick of<br />guessing.
        </h1>

        <div className="space-y-5 text-lg sm:text-xl text-[#4A4137]/80 leading-relaxed">
          <p>Two years of open homes. Listings underquoted by half a million. Inspections that swallowed our weekends.</p>
          <p>Every agent gave the same answer:</p>
          <p className="text-2xl sm:text-3xl font-bold text-[#3A342D] py-2">"Make an offer."</p>
          <p>So we did. Then we watched it sell for six figures more than the guide.</p>
        </div>

        <div className="mt-20">
          <ImagePlaceholder
            label="Couple at the kitchen table, laptop open, listings on screen — late evening"
            aspectRatio="16/10"
          />
        </div>

        {/* Realisation */}
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#3A342D] mt-32 mb-10 leading-[1.05]">
          Then it clicked.
        </h2>

        <div className="space-y-5 text-lg sm:text-xl text-[#4A4137]/80 leading-relaxed">
          <p>Every seller has a number. Every buyer has a number.</p>
          <p>The system just hides it.</p>
          <p>The problem isn't the market. It's the silence.</p>
        </div>

        <p className="text-3xl sm:text-4xl font-bold tracking-tight text-[#C9A961] leading-tight my-20 text-center">
          The number already exists.<br />
          <span className="text-[#3A342D]">We're just bringing it into the open.</span>
        </p>

        {/* What we built */}
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#3A342D] mt-32 mb-10 leading-[1.05]">
          So we built it.
        </h2>

        <div className="space-y-5 text-lg sm:text-xl text-[#4A4137]/80 leading-relaxed">
          <p>Sellers say what they're actually open to.</p>
          <p>Buyers see where someone's already willing to talk numbers.</p>
          <p>No more guessing. No more wasted Saturdays.</p>
        </div>

        {/* V1 */}
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#3A342D] mt-32 mb-10 leading-[1.05]">
          It's V1.
        </h2>

        <div className="space-y-5 text-lg sm:text-xl text-[#4A4137]/80 leading-relaxed">
          <p>It isn't perfect. We're figuring it out in real time.</p>
          <p className="text-[#3A342D] font-bold">We're building this with you.</p>
          <p>If something's missing, broken, or wrong — tell us.</p>
        </div>

        {/* CTA */}
        <div className="mt-32 mb-12 text-center">
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] mb-10 leading-tight">
            If you've felt the same frustration —<br />we built this for you.
          </p>
          <button
            onClick={() => { onSearch?.(); onBack(); }}
            className="bg-[#C9A961] text-white h-14 px-10 rounded-2xl font-bold hover:bg-[#3A342D] transition-all uppercase tracking-widest text-[11px]"
          >
            Search a property
          </button>
        </div>
      </article>
    </div>
  );
};

export default OurStory;
