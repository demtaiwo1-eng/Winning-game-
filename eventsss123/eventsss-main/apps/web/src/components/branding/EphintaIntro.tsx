import { useEffect, useState } from "react";
import "./ephinta-intro.css";

const INTRO_MS = 2600;
const SESSION_KEY = "ephinta.intro.seen";

export default function EphintaIntro() {
  const [visible, setVisible] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) !== "1"; }
    catch { return true; }
  });

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      setVisible(false);
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* optional storage */ }
    }, INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="ephinta-intro" role="status" aria-label="Opening EPHINTA" data-ephinta-intro-overlay="true">
      <div className="ephinta-intro__lockup">
        <img src="/brand/ephinta_logo2.png?v=20261010-092247" alt="" className="ephinta-intro__logo" />
        <span className="ephinta-intro__wordmark">EPHINTA</span>
        <span className="ephinta-intro__tagline">EPHINTA</span>
      </div>
      <span className="ephinta-intro__progress" aria-hidden="true"><i /></span>
    </div>
  );
}
