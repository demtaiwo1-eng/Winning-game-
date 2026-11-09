import { useEffect, useState } from "react";

const logoUrl = `${import.meta.env.BASE_URL}brand/ephinta_logo2.png`;
const APP_READY_EVENT = "ephinta:app-ready";

export default function EphintaIntro() {
  const [visible, setVisible] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const handleAppReady = () => setAppReady(true);
    if (document.documentElement.dataset.ephintaAppReady === "true") {
      handleAppReady();
    }
    window.addEventListener(APP_READY_EVENT, handleAppReady, { once: true });
    return () => window.removeEventListener(APP_READY_EVENT, handleAppReady);
  }, []);

  useEffect(() => {
    if (!visible || !appReady || !logoLoaded) return;
    setClosing(true);
    const timer = window.setTimeout(() => setVisible(false), 350);
    return () => window.clearTimeout(timer);
  }, [appReady, logoLoaded, visible]);

  if (!visible) return null;
  return (
    <div
      className={`ephinta-intro${closing ? " ephinta-intro--closing" : ""}`}
      role="status"
      aria-label="Opening EPHINTA"
      data-ephinta-intro-splash="true"
      data-ephinta-intro-overlay="true"
    >
      <img
        src={logoUrl}
        alt="EPHINTA logo"
        className="ephinta-intro__logo"
        fetchPriority="high"
        onLoad={() => setLogoLoaded(true)}
        onError={() => {
          console.error(`Unable to load the EPHINTA startup logo: ${logoUrl}`);
          setLogoLoaded(true);
        }}
      />
    </div>
  );
}
