export const SAMPLE_URL = "/sample/daily-data-response.json";
const PROXY_URL = "/api/telemetry";

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

function readError(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return `Request failed (HTTP ${status}).`;
}

/**
 * Every request goes through `/api/telemetry` (Vite middleware in dev, a Vercel function in
 * production). The bearer token lives in server-side env; a token saved in Settings is forwarded
 * as a header for that one call. This keeps the browser same-origin and immune to upstream CORS.
 */
async function postTelemetry({ uin, apiDate, token, signal }: FetchDailyArgs): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const override = token.trim();
  if (override) headers["x-api-token"] = override;

  let response: Response;
  try {
    response = await fetch(PROXY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ uin: uin.trim(), date: apiDate }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("Could not reach the telemetry proxy (/api/telemetry).");
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`Telemetry proxy returned invalid JSON (HTTP ${response.status}).`);
    }
  }
  if (!response.ok) throw new Error(readError(payload, response.status));
  return payload;
}

export async function fetchDailyData(args: FetchDailyArgs): Promise<unknown> {
  const { uin } = args;
  if (!uin.trim()) throw new Error("Enter a drone UIN.");

  const payload = await postTelemetry(args);
  const apiError = apiErrorMessage(payload);
  if (apiError) throw new Error(apiError);
  return payload;
}

export async function loadSampleData(signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(SAMPLE_URL, { signal });
  if (!response.ok) throw new Error(`Sample data is unavailable (HTTP ${response.status}).`);
  return (await response.json()) as unknown;
}
