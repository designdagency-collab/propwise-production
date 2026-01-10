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

  const handleDownload = async () => {
    // Check if Web Share API is available (mobile)
    if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      try {
        // Convert base64 to blob for sharing
        const response = await fetch(afterImage);
        const blob = await response.blob();
        const file = new File([blob], `upblock-${type}-visualisation.png`, { type: 'image/png' });
        
        await navigator.share({
          files: [file],
          title: `Upblock ${type === 'development' ? 'Development' : 'Renovation'} Visualisation`,
        });
        return;
      } catch (err) {
        // If share fails, fall through to alternative methods
        console.log('Share failed, trying alternative:', err);
      }
    }
    
    // Try opening in new tab for mobile (allows long-press to save)
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      const newTab = window.open();
      if (newTab) {
        newTab.document.write(`
          <html>
            <head><title>Upblock Visualisation</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
              <img src="${afterImage}" style="max-width:100%;max-height:100vh;" />
              <p style="position:fixed;bottom:20px;left:0;right:0;text-align:center;color:white;font-family:sans-serif;font-size:14px;">
                Long-press image to save
              </p>
            </body>
          </html>
        `);
        newTab.document.close();
        return;
      }
    }
    
    // Desktop fallback - standard download
    const link = document.createElement('a');
    link.href = afterImage;
    link.download = `upblock-${type}-visualisation.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pt-16 pb-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-4xl mx-4 max-h-[calc(100vh-5rem)] overflow-y-auto bg-white rounded-[1.5rem] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-neutral-100 px-5 py-4 flex items-center justify-between rounded-t-[1.5rem]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${type === 'development' ? 'bg-[#4A4137] text-white' : 'bg-[#D3D9B5] text-white'}`}>
              <i className={`fa-solid ${type === 'development' ? 'fa-city' : 'fa-wand-magic-sparkles'}`}></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#3A342D]">
                {type === 'development' ? 'Development Visualisation' : 'Renovation Visualisation'}
              </h2>
              <p className="text-xs text-[#C9A961] font-semibold">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-times text-neutral-600 text-sm"></i>
          </button>
        </div>

        {/* Image Display - Slider only if we have a before image */}
        <div className="p-4">
          {beforeImage ? (
            // Before/After Slider (when original image is available)
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
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg cursor-col-resize z-10"
                style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-[#C9A961]">
                  <i className="fa-solid fa-arrows-left-right text-[#C9A961] text-sm"></i>
                </div>
              </div>

              {/* Drag hint */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-md pointer-events-none z-20">
                <span className="text-neutral-600 text-[10px] font-semibold flex items-center gap-1.5">
                  <i className="fa-solid fa-hand-pointer text-[#C9A961]"></i>
                  Drag to compare
                </span>
              </div>
            </div>
          ) : (
            // AI Generated Image only (cached results - no original available)
            <div className="relative w-full aspect-video overflow-hidden rounded-2xl shadow-xl bg-neutral-900">
              <img 
                src={afterImage} 
                alt="AI Generated" 
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Cached indicator */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-md pointer-events-none z-20">
                <span className="text-neutral-600 text-[10px] font-semibold flex items-center gap-1.5">
                  <i className="fa-solid fa-wand-magic-sparkles text-[#C9A961]"></i>
                  AI Generated Concept
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Description & Actions */}
        <div className="px-5 pb-5">
          {description && (
            <div className="mb-4 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
              <p className="text-xs text-neutral-600 leading-relaxed">{description}</p>
            </div>
          )}

          <div className="flex justify-end">
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#C9A961] hover:bg-[#3A342D] transition-colors shadow-md flex items-center gap-2"
              >
                <i className="fa-solid fa-download"></i>
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RenovationModal;

