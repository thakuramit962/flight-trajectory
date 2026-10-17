const ACRE_IN_SQM = 4046.8564224;

export function fmtDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function fmtAcres(acres: number): string {
  if (!Number.isFinite(acres) || acres <= 0) return "0 ac";
  return `${acres.toFixed(2)} ac`;
}

export function fmtAcresToSqm(acres: number): string {
  return `${Math.round(acres * ACRE_IN_SQM).toLocaleString()} m²`;
}

export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function fmtPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

export function fmtNumber(value: number | null, digits = 1, suffix = ""): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}
