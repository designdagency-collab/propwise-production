import { useEffect, useRef, useState } from 'react';

interface Props {
  address: string;
  onBack: () => void;
}

type Status = 'loading' | 'ready' | 'unavailable' | 'error';

let mapsScriptPromise: Promise<void> | null = null;

const loadMapsScript = (apiKey: string): Promise<void> => {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if ((window as any).google?.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=alpha&libraries=maps3d,geocoding&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      mapsScriptPromise = null;
      reject(new Error('Failed to load Google Maps JS'));
    };
    document.head.appendChild(script);
  });

  return mapsScriptPromise;
};

export function Property3DView({ address, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setStatus('error');
      setErrorMsg('VITE_GOOGLE_MAPS_API_KEY not configured in Vercel env');
      return;
    }

    (async () => {
      try {
        await loadMapsScript(apiKey);
        if (cancelled) return;

        const google = (window as any).google;
        const { Geocoder } = await google.maps.importLibrary('geocoding');
        const geocoder = new Geocoder();
        const { results } = await geocoder.geocode({
          address: address.includes('Australia') ? address : `${address}, Australia`,
        });
        if (cancelled) return;
        if (!results || !results.length) {
          setStatus('unavailable');
          return;
        }
        const loc = results[0].geometry.location;
        const lat = loc.lat();
        const lng = loc.lng();

        await google.maps.importLibrary('maps3d');
        if (cancelled || !containerRef.current) return;

        const map3d: any = document.createElement('gmp-map-3d');
        map3d.setAttribute('center', `${lat},${lng},150`);
        map3d.setAttribute('range', '350');
        map3d.setAttribute('tilt', '60');
        map3d.setAttribute('heading', '0');
        map3d.style.width = '100%';
        map3d.style.height = '100%';
        map3d.style.display = 'block';

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(map3d);
        setStatus('ready');
      } catch (e: any) {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(e?.message || 'Failed to load 3D view');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <div className="absolute inset-0 z-10 bg-[#1a1a1a]">
      <div ref={containerRef} className="absolute inset-0" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none">
          <div className="text-center">
            <i className="fa-solid fa-cube text-4xl mb-3 animate-pulse"></i>
            <p className="font-medium">Loading 3D view…</p>
          </div>
        </div>
      )}
      {status === 'unavailable' && (
        <div className="absolute inset-0 flex items-center justify-center text-white p-8 text-center">
          <div>
            <i className="fa-solid fa-map-location-dot text-4xl mb-3 opacity-60"></i>
            <p className="font-bold mb-2">3D not available for this address</p>
            <p className="text-sm opacity-70">
              Photorealistic 3D imagery only covers major Australian metros.
            </p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-white p-8 text-center">
          <div>
            <i className="fa-solid fa-triangle-exclamation text-4xl mb-3 opacity-60"></i>
            <p className="font-bold mb-2">Couldn't load 3D view</p>
            <p className="text-sm opacity-70">{errorMsg}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="absolute top-4 left-4 z-20 px-4 py-2 bg-white/90 backdrop-blur hover:bg-white rounded-full text-sm font-bold text-[#3A342D] shadow-lg flex items-center gap-2 transition-colors"
      >
        <i className="fa-solid fa-arrow-left text-xs"></i>
        Back to satellite
      </button>
    </div>
  );
}
