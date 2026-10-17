export interface AppConfig {
  apiBase: string;
  token: string;
  uin: string;
  /** ISO date (yyyy-mm-dd) used by the date picker. */
  date: string;
}

const TOKEN_STORAGE_KEY = "agri-flight-map.token";
const TOKEN_PLACEHOLDER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

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

/** Runtime token (saved from the UI) wins over the build-time .env value. */
export const config: AppConfig = {
  apiBase: (import.meta.env.VITE_API_BASE as string | undefined) ?? "https://apidata.iotechworld.com",
  token: readRuntimeToken() || ((import.meta.env.VITE_API_TOKEN as string | undefined) ?? ""),
  uin: (import.meta.env.VITE_UIN as string | undefined) ?? "UA00FUGD0TC",
  date: (import.meta.env.VITE_DATE as string | undefined) ?? "2026-10-16",
};

export { TOKEN_PLACEHOLDER, TOKEN_STORAGE_KEY };
