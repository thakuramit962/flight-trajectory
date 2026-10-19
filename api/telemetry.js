/**
 * Vercel serverless proxy for the drone telemetry API.
 *
 * Keeps the bearer token on the server so it is never shipped in the browser bundle.
 * The client calls POST /api/telemetry with { uin, date } and gets the raw API payload back.
 *
 * Required environment variable (Vercel → Project → Settings → Environment Variables):
 *   API_TOKEN   bearer token for apidata.iotechworld.com
 *
* A request header `x-api-token` overrides it for a single call (used by the Settings field).
 * Optional:
 *   API_BASE    defaults to https://apidata.iotechworld.com
 */

const DEFAULT_BASE = "https://apidata.iotechworld.com";
const UIN_PATTERN = /^[A-Za-z0-9_-]{4,32}$/;
const DATE_PATTERN = /^\d{2}-\d{2}-\d{4}$/;

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed. Use POST." });
  }

  const override =
    req.headers && typeof req.headers["x-api-token"] === "string" ? req.headers["x-api-token"].trim() : "";
  const token = override || (process.env.API_TOKEN || "").trim();
  if (!token) {
    return send(res, 500, {
      error: "API_TOKEN is not configured on the server. Add it in the Vercel project settings.",
    });
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { error: "Request body must be JSON." });
  }

  const uin = typeof body.uin === "string" ? body.uin.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim() : "";

  if (!UIN_PATTERN.test(uin)) {
    return send(res, 400, { error: "uin is missing or malformed." });
  }
  if (!DATE_PATTERN.test(date)) {
    return send(res, 400, { error: "date must use dd-mm-yyyy." });
  }

  const base = (process.env.API_BASE || DEFAULT_BASE).replace(/\/+$/, "");

  try {
    const upstream = await fetch(`${base}/fetchapi/data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uin, date }),
      signal: AbortSignal.timeout(25_000),
    });

    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return send(res, 502, { error: `Upstream returned a non-JSON response (HTTP ${upstream.status}).` });
    }

    if (!upstream.ok) {
      const message =
        upstream.status === 401 || upstream.status === 403
          ? "Upstream rejected the bearer token configured in API_TOKEN."
          : `Upstream request failed (HTTP ${upstream.status}).`;
      return send(res, 502, { error: message });
    }

    return send(res, 200, payload);
  } catch (error) {
    const timedOut = error && (error.name === "TimeoutError" || error.name === "AbortError");
    return send(res, 504, {
      error: timedOut
        ? "Telemetry API timed out."
        : `Could not reach the telemetry API${error && error.message ? `: ${error.message}` : "."}`,
    });
  }
}
