import React from 'react';

interface OurStoryProps {
  onBack: () => void;
  onSearch?: () => void;
}

interface ImagePlaceholderProps {
  label: string;
  aspectRatio?: string;
}

const ImagePlaceholder: React.FC<ImagePlaceholderProps> = ({ label, aspectRatio = '16/9' }) => (
  <div
    className="rounded-2xl flex items-center justify-center my-10"
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

const PullQuote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <blockquote
    className="my-10 p-6 sm:p-8 rounded-2xl text-center"
    style={{
      backgroundColor: '#C9A961',
      backgroundImage: 'linear-gradient(135deg, rgba(201,169,97,0.10) 0%, rgba(201,169,97,0.04) 100%)',
      backgroundColor: 'transparent',
      border: '1px solid #DCD7CE',
      borderLeft: '4px solid #C9A961',
    }}
  >
    <p className="text-xl sm:text-2xl font-bold tracking-tight text-[#3A342D] leading-snug">
      {children}
    </p>
  </blockquote>
);

const OurStory: React.FC<OurStoryProps> = ({ onBack, onSearch }) => {
  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-24 pb-8">
        <button
          onClick={onBack}
          className="text-sm font-bold uppercase tracking-widest text-[#4A4137]/60 hover:text-[#C9A961] transition-colors"
        >
          <i className="fa-solid fa-arrow-left mr-2"></i>Back
        </button>
      </div>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
        {/* Hero */}
        <span className="inline-block px-3 py-1 bg-[#C9A961]/10 text-[#C9A961] rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">
          Our story
        </span>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#3A342D] leading-[1.1] mb-8">
          Trying to buy a home shouldn't feel like a guessing game.
        </h1>

        <ImagePlaceholder
          label="Hero — couple at the kitchen table, laptop open, listings on the screen"
          aspectRatio="16/10"
        />

        {/* Section: Ordinary world */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] mt-16 mb-6">
          We're just a couple trying to buy a home.
        </h2>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          Like a lot of Australians right now.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          Weekends spent at open homes. Late nights scrolling listings. Trying to plan a future on top of a market that keeps shifting under our feet.
        </p>

        {/* Section: Every open home */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] mt-16 mb-6">
          Every open home felt the same.
        </h2>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          You walk in. You try to read the room. You ask the agent the only question that actually matters:
        </p>
        <p className="text-lg sm:text-xl font-bold text-[#3A342D] leading-relaxed mb-6">
          "What's the price?"
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          And the answer is always some version of: <em>"Make an offer."</em> Or: <em>"We're seeing strong interest."</em> Or that little pause that tells you they know but they're not saying.
        </p>

        <PullQuote>
          Everyone has a number…<br />but no one says it.
        </PullQuote>

        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          We were trying to buy interstate too. Booking flights. Taking time off. Driving past houses we'd never afford.
        </p>

        <ImagePlaceholder
          label="Open home — front door, agent with a clipboard, shoes piling up on the porch"
        />

        {/* Section: Wear us down */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] mt-16 mb-6">
          It started to wear us down.
        </h2>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          Properties advertised at $1.2M selling for $1.6M. Auction guides off by half a million. Open homes that turned into wasted Saturdays.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          Inspections we rearranged our week for. Numbers we couldn't trust. Agents who couldn't — or wouldn't — be straight with us.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          It wasn't just expensive. It was exhausting.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          You start to feel like you're always one step behind something you can't even see.
        </p>

        {/* Section: It clicked */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] mt-16 mb-6">
          At some point it clicked.
        </h2>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          Every seller has a number. Every buyer has a number.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          The system just hides it.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          Sellers won't say what they want, in case they leave money on the table. Buyers won't say what they'd pay, in case they tip their hand.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          So we all dance around it. Open homes, offers, withdrawn offers, silent rejections.
        </p>

        <PullQuote>
          The problem isn't the market.<br />It's the lack of transparency.
        </PullQuote>

        <ImagePlaceholder
          label="Concept — seller's hand and buyer's hand reaching toward the same number on a chalkboard / sticky note"
        />

        {/* Section: Stopped waiting */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] mt-16 mb-6">
          So we stopped waiting for the system to change.
        </h2>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          We decided to build something ourselves.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          Not an algorithm. Not a "platform." Just a way to bring the number into the open.
        </p>

        {/* Section: Upblock is simple */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] mt-16 mb-6">
          Upblock is simple.
        </h2>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          Sellers share what they're actually open to.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          Buyers see suburbs and properties where someone's already willing to talk numbers.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          Buyers agents, developers, renovators, first home buyers — anyone trying to make a real decision instead of a hopeful one.
        </p>

        <PullQuote>
          The number already exists.<br />We're just bringing it into the open.
        </PullQuote>

        <ImagePlaceholder
          label="Product — laptop screen showing the upblock report or leads dashboard"
          aspectRatio="16/10"
        />

        {/* Section: V1 */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] mt-16 mb-6">
          This is V1.
        </h2>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          We're being upfront — it isn't perfect.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          It's our first version. We're figuring out a lot of it in real time. There are corners that are rough. Things we'll get wrong before we get right.
        </p>

        <PullQuote>We're building this with you.</PullQuote>

        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          If a feature's missing, tell us. If something's broken, tell us. If you think we've got it wrong — really tell us.
        </p>

        {/* Section: Bigger thing */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] mt-16 mb-6">
          This is bigger than a tool.
        </h2>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          It's about changing how people think about property.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-4">
          Less about who you know. Less about reading between the lines. Less about hoping the agent calls you back.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-6">
          Transparency. Control. Confidence.
        </p>

        <PullQuote>We want people to feel like they're in control again.</PullQuote>

        <ImagePlaceholder
          label="Wider vision — Australian suburban street, late afternoon light, sense of community"
          aspectRatio="16/9"
        />

        {/* CTA */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A342D] mt-16 mb-6">
          If you've ever felt the same frustration — we built this for you.
        </h2>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-2">
          Search any Australian address. Free.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-8">
          Or sign up if you're open to offers on yours.
        </p>
        <p className="text-base sm:text-lg text-[#4A4137]/80 leading-relaxed mb-10">
          Tell us what works, what doesn't, and what we should build next.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button
            onClick={() => { onSearch?.(); onBack(); }}
            className="flex-1 bg-[#C9A961] text-white h-14 rounded-2xl font-bold hover:bg-[#3A342D] transition-all uppercase tracking-widest text-[11px]"
          >
            <i className="fa-solid fa-magnifying-glass mr-2"></i>
            Search a property
          </button>
          <button
            onClick={onBack}
            className="flex-1 bg-white text-[#3A342D] h-14 rounded-2xl font-bold hover:bg-[#F0EDE5] transition-all uppercase tracking-widest text-[11px]"
            style={{ border: '1px solid #DCD7CE' }}
          >
            Back to home
          </button>
        </div>
      </article>
    </div>
  );
};

export default OurStory;
