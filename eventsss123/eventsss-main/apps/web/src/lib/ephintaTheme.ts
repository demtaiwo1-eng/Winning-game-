/** Shared EPHINTA theme preference for landing and authenticated application areas. */
export type EphintaTheme = "dark" | "light" | "colorful";
const STORAGE_KEY = "ephinta:theme";
const THEMES: EphintaTheme[] = ["dark", "light", "colorful"];

export function normalizeEphintaTheme(value: unknown): EphintaTheme {
  return THEMES.includes(value as EphintaTheme) ? value as EphintaTheme : "colorful";
}

export function getEphintaTheme(): EphintaTheme {
  try {
    return normalizeEphintaTheme(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function applyEphintaTheme(value: unknown): EphintaTheme {
  const theme = normalizeEphintaTheme(value);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.ephintaTheme = theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage may be disabled; theme still applies to the current page.
  }
  return theme;
}

export function initializeEphintaTheme(): EphintaTheme {
  return applyEphintaTheme(getEphintaTheme());
}
