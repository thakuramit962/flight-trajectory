export interface AppConfig {
  /** Token typed in Settings for this browser only; the server-side proxy supplies the default. */
  token: string;
  uin: string;
  /** ISO date (yyyy-mm-dd) used by the date picker. */
  date: string;
}

const TOKEN_STORAGE_KEY = "agri-flight-map.token";

function readRuntimeToken(): string {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveRuntimeToken(token: string): void {
  try {
    if (token.trim()) window.localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage can be unavailable in private mode — the in-memory value still works */
  }
}

/**
 * No token is read from the build: the bearer token stays in server env (`API_TOKEN`) and is
 * attached by `/api/telemetry`, so it can never be extracted from the JavaScript bundle.
 */
export const config: AppConfig = {
  token: readRuntimeToken(),
  uin: (import.meta.env.VITE_UIN as string | undefined) ?? "UA00FUGD0TC",
  date: (import.meta.env.VITE_DATE as string | undefined) ?? "2026-10-16",
};
