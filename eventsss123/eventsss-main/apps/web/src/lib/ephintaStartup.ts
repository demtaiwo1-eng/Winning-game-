/**
 * Startup guard helpers for EPHINTA.
 * Call markEphintaAppReady() once the application shell has mounted.
 * The watchdog is a final safety net for splash/intro overlays that opt into
 * [data-ephinta-intro-overlay]; it never clears auth state or changes routes.
 */
const READY_EVENT = "ephinta:app-ready";

export function markEphintaAppReady(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(READY_EVENT));
  document.documentElement.dataset.ephintaAppReady = "true";
  document.documentElement.classList.add("ephinta-app-ready");
}

export function installEphintaIntroWatchdog(maxWaitMs = 6500): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    document.documentElement.dataset.ephintaIntroExpired = "true";
    document.documentElement.classList.add("ephinta-intro-expired");
    document.querySelectorAll<HTMLElement>("[data-ephinta-intro-overlay]").forEach((node) => {
      node.setAttribute("aria-hidden", "true");
      node.style.pointerEvents = "none";
      node.style.opacity = "0";
      node.style.visibility = "hidden";
    });
  };
  const timer = window.setTimeout(finish, Math.max(1500, maxWaitMs));
  window.addEventListener(READY_EVENT, finish, { once: true });
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener(READY_EVENT, finish);
  };
}
