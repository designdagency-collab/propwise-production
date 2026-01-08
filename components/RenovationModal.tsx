import React, { useState, useRef, useEffect } from 'react';

interface RenovationModalProps {
  isOpen: boolean;
  onClose: () => void;
  beforeImage: string;
  afterImage: string;
  title: string;
  type: 'renovation' | 'development';
  description?: string;
}

const RenovationModal: React.FC<RenovationModalProps> = ({
  isOpen,
  onClose,
  beforeImage,
  afterImage,
  title,
  type,
  description
}) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, x)));
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isResizing.current) return;
    handleMove(e.clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isResizing.current) return;
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleUp = () => { isResizing.current = false; };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
    window.addEventListener('keydown', handleEsc);
    
    return () => {
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Reset slider position when modal opens
  useEffect(() => {
    if (isOpen) {
      setSliderPos(50);
    }
  }, [isOpen]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = afterImage;
    link.download = `upblock-${type}-visualization.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-6xl mx-4 max-h-[95vh] overflow-y-auto bg-white rounded-[2rem] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-neutral-100 px-8 py-6 flex items-center justify-between rounded-t-[2rem]">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${type === 'development' ? 'bg-[#4A4137] text-white' : 'bg-[#D3D9B5] text-white'}`}>
              <i className={`fa-solid ${type === 'development' ? 'fa-city' : 'fa-wand-magic-sparkles'} text-lg`}></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#3A342D]">
                {type === 'development' ? 'Development Visualization' : 'Renovation Visualization'}
              </h2>
              <p className="text-sm text-[#C9A961] font-semibold">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-times text-neutral-600"></i>
          </button>
        </div>

        {/* Before/After Slider */}
        <div className="p-6">
          <div 
            ref={containerRef}
            className="relative w-full aspect-video overflow-hidden rounded-2xl shadow-xl cursor-col-resize select-none bg-neutral-900"
            onMouseDown={() => { isResizing.current = true; }}
            onTouchStart={() => { isResizing.current = true; }}
            onMouseMove={onMouseMove}
            onTouchMove={onTouchMove}
          >
            {/* After Image (AI Generated) - Full width background */}
            <img 
              src={afterImage} 
              alt="After" 
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Before Image (Original - Clipped from right) */}
            <div 
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
              <img 
                src={beforeImage} 
                alt="Before" 
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>

            {/* Slider Bar */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-col-resize z-10"
              style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-[#C9A961]">
                <i className="fa-solid fa-arrows-left-right text-[#C9A961]"></i>
              </div>
            </div>

            {/* Labels */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest pointer-events-none z-20">
              <i className="fa-solid fa-camera mr-2"></i>
              Original
            </div>
            <div className="absolute top-4 right-4 bg-[#C9A961] text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest pointer-events-none z-20">
              <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
              AI {type === 'development' ? 'Render' : 'Renovation'}
            </div>

            {/* Drag hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg pointer-events-none z-20">
              <span className="text-neutral-600 text-xs font-semibold flex items-center gap-2">
                <i className="fa-solid fa-hand-pointer text-[#C9A961]"></i>
                Drag to compare
              </span>
            </div>
          </div>
        </div>

        {/* Description & Actions */}
        <div className="px-8 pb-8">
          {description && (
            <div className="mb-6 p-4 bg-neutral-50 rounded-xl border border-neutral-100">
              <p className="text-sm text-neutral-600 leading-relaxed">{description}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <p className="text-xs text-neutral-400 italic">
              <i className="fa-solid fa-shield-halved mr-1"></i>
              AI-generated visualization. Original image not stored.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-full text-sm font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleDownload}
                className="px-6 py-3 rounded-full text-sm font-bold text-white bg-[#C9A961] hover:bg-[#3A342D] transition-colors shadow-lg flex items-center gap-2"
              >
                <i className="fa-solid fa-download"></i>
                Download AI Image
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RenovationModal;

