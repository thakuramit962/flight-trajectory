import { config } from "../config";

export const SAMPLE_URL = "/sample/daily-data-response.json";

/** Converts a date-picker value (yyyy-mm-dd) to the API's dd-mm-yyyy format. */
export function toApiDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) throw new Error("Pick a valid date (expected yyyy-mm-dd).");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Converts the API's dd-mm-yyyy format back to yyyy-mm-dd for date inputs. */
export function fromApiDate(apiDate: string): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(apiDate.trim());
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

interface FetchDailyArgs {
  uin: string;
  /** dd-mm-yyyy */
  apiDate: string;
  token: string;
  signal?: AbortSignal;
}

function apiErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) {
    for (const entry of data) {
      if (typeof entry !== "object" || entry === null) continue;
      const code = (entry as { code?: unknown }).code;
      const message = (entry as { message?: unknown }).message;
      if (typeof code === "number" && code !== 200) {
        return typeof message === "string" ? message : `API returned code ${code}`;
      }
    }
  }
  return null;
}

export async function fetchDailyData({ uin, apiDate, token, signal }: FetchDailyArgs): Promise<unknown> {
  if (!token.trim()) {
    throw new Error("No API token configured. Open Settings and paste the bearer token.");
  }
  if (!uin.trim()) throw new Error("Enter a drone UIN.");

  let response: Response;
  try {
    response = await fetch(`${config.apiBase}/fetchapi/data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.trim()}`,
      },
      body: JSON.stringify({ uin: uin.trim(), date: apiDate }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error(
      `Could not reach ${config.apiBase}. Check the network connection or the API base URL.`,
    );
  }

  const text = await response.text();
  if (!response.ok) {
    const hint = response.status === 401 || response.status === 403 ? " The bearer token was rejected." : "";
    throw new Error(`API request failed (HTTP ${response.status}).${hint}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error("API returned a response that is not valid JSON.");
  }

  const apiError = apiErrorMessage(payload);
  if (apiError) throw new Error(apiError);
  return payload;
}

export async function loadSampleData(signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(SAMPLE_URL, { signal });
  if (!response.ok) throw new Error(`Sample data is unavailable (HTTP ${response.status}).`);
  return (await response.json()) as unknown;
}
