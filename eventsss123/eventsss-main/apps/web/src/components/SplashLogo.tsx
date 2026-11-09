import React, { useEffect, useState } from 'react';

const logoUrl = `${import.meta.env.BASE_URL}brand/ephinta_logo2.png`;

/**
 * Branded loading screen using the approved EPHINTA logo asset.
 * The app is mounted underneath so it is ready when the splash fades.
 */
export default function SplashLogo({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>('in');

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase('out'), 1400);
    const t2 = window.setTimeout(() => setPhase('done'), 1900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (phase === 'done') return <>{children}</>;

  return (
    <>
      <div
        style={{
          visibility: phase === 'out' ? 'visible' : 'hidden',
          position: phase === 'out' ? 'relative' : 'absolute',
          inset: 0,
        }}
        aria-hidden={phase !== 'out'}
      >
        {children}
      </div>

      <div
        role="status"
        aria-label="Loading EPHINTA"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'grid',
          placeItems: 'center',
          background: 'radial-gradient(ellipse at center, #24104f 0%, #10002f 72%)',
          opacity: phase === 'out' ? 0 : 1,
          transition: 'opacity 0.45s ease',
          pointerEvents: phase === 'out' ? 'none' : 'auto',
        }}
      >
        <div style={{ textAlign: 'center', animation: 'ephintaLogoPulse 1.4s ease-in-out infinite' }}>
          <img
            src={logoUrl}
            alt="EPHINTA"
            width={144}
            height={144}
            fetchPriority="high"
            style={{
              display: 'block',
              width: 'min(144px, 38vw)',
              height: 'auto',
              aspectRatio: '1',
              objectFit: 'contain',
              margin: '0 auto 16px',
              filter: 'drop-shadow(0 12px 32px rgba(150, 90, 255, .35))',
            }}
          />
          <div
            style={{
              color: '#fff',
              fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
              fontWeight: 900,
              fontSize: 22,
              letterSpacing: '0.14em',
            }}
          >
            EPHINTA
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              fontWeight: 600,
              color: '#d5bfff',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            Preparing your experience
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ephintaLogoPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.035); opacity: .94; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </>
  );
}
