import React, { useEffect, useState } from 'react';

/**
 * Branded splash: shield logo + ESS GLOBAL wordmark.
 * Shows for ~1.6s then fades out and reveals children (the landing page).
 * Mobile-safe, no external assets required.
 */
export default function SplashLogo({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('out'), 1400);
    const t2 = setTimeout(() => setPhase('done'), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === 'done') return <>{children}</>;

  return (
    <>
      {/* Landing is mounted underneath so it is ready when splash ends */}
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
        aria-label="Loading ESS Global"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'grid',
          placeItems: 'center',
          background: 'radial-gradient(ellipse at center, #0e1a33 0%, #020617 70%)',
          opacity: phase === 'out' ? 0 : 1,
          transition: 'opacity 0.45s ease',
          pointerEvents: phase === 'out' ? 'none' : 'auto',
        }}
      >
        <div style={{ textAlign: 'center', animation: 'essPulse 1.4s ease-in-out infinite' }}>
          {/* Shield mark */}
          <div
            style={{
              width: 72,
              height: 72,
              margin: '0 auto 16px',
              borderRadius: 18,
              background: 'linear-gradient(135deg, #22d3ee, #3b82f6, #6366f1)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 0 40px rgba(34, 211, 238, 0.45)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div
            style={{
              fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
              fontWeight: 900,
              fontSize: 22,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(90deg, #fff, #67e8f9, #93c5fd)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ESS GLOBAL
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              fontWeight: 600,
              color: '#67e8f9',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            EPHINTA
          </div>
        </div>
      </div>

      <style>{`
        @keyframes essPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.92; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </>
  );
}
