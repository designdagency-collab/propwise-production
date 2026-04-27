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
        {/* The hook — instant recognition */}
        <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tighter text-[#3A342D] leading-[0.9] mt-12 mb-8">
          What's the<br />price?
        </h1>

        <p className="text-xl sm:text-2xl text-[#4A4137]/80 leading-snug font-medium mb-4">
          Every buyer asks. No one answers.
        </p>

        <div className="space-y-4 text-lg sm:text-xl text-[#4A4137]/80 leading-relaxed">
          <p>Every open home. Every email. Every phone call.</p>
          <p className="text-[#3A342D] font-bold">Everyone has a number. No one says it.</p>
        </div>

        {/* The frustration — concrete + brief */}
        <div className="space-y-4 text-lg sm:text-xl text-[#4A4137]/80 leading-relaxed mt-12">
          <p>Two years of open homes. Listings underquoted by half a million. Saturdays we'll never get back.</p>
          <p>We named our number. It still sold for six figures over the guide.</p>
          <p className="text-[#3A342D] font-bold">We were done guessing.</p>
        </div>

        <div className="mt-16">
          <ImagePlaceholder
            label="Couple at the kitchen table, laptop open, listings on screen — late evening"
            aspectRatio="16/10"
          />
        </div>

        {/* The realisation — the central pull-quote */}
        <p className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight my-24 text-center">
          <span className="text-[#C9A961]">The number already exists.</span><br />
          <span className="text-[#3A342D]">We're just bringing it into the open.</span>
        </p>

        {/* What we built — 3 short lines */}
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#3A342D] mb-10 leading-[1.05]">
          So we built it.
        </h2>

        <div className="space-y-4 text-lg sm:text-xl text-[#4A4137]/80 leading-relaxed">
          <p>Sellers say what they're actually open to.</p>
          <p>Buyers see where someone's already willing to talk.</p>
          <p className="text-[#3A342D] font-bold">No more guessing. No more wasted Saturdays.</p>
        </div>

        {/* V1 honesty */}
        <div className="space-y-4 text-lg sm:text-xl text-[#4A4137]/80 leading-relaxed mt-24">
          <p>This is V1. It isn't perfect.</p>
          <p>We're building it with you. Tell us what's missing.</p>
        </div>

        {/* CTA */}
        <div className="mt-24 mb-12 text-center">
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] mb-10 leading-tight">
            Sick of guessing too?
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
