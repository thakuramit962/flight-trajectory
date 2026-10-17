import type {
  Dataset,
  FlightLog,
  Mission,
  PathRun,
  RawLog,
  Segment,
  SprayRule,
} from "../types";
import { haversineMeters } from "./geo";

const ACRE_IN_SQM = 4046.8564224;
const HECTARE_IN_ACRES = 2.4710538147;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text || /^(n\/a|null|-)$/i.test(text)) return null;
  const parsed = Number.parseFloat(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parses "0.42 Acre" / "0.42 acre" / "1.2 ha" / "520 m2" / 0.42 into acres. */
export function parseAreaAcres(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  if (!text || /^(n\/a|null|-)$/.test(text)) return null;
  const parsed = Number.parseFloat(text.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  if (text.includes("hect") || /\bha\b/.test(text)) return parsed * HECTARE_IN_ACRES;
  if (text.includes("m2") || text.includes("m²") || text.includes("sq")) return parsed / ACRE_IN_SQM;
  return parsed;
}

function parseClock(value: unknown): number {
  if (typeof value !== "string") return 0;
  const [h = 0, m = 0, s = 0] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (![h, m, s].every((part) => Number.isFinite(part))) return 0;
  return h * 3600 + m * 60 + s;
}

function readString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * The API wraps telemetry as { data: [{ response: { MISSION: [...] } }] }.
 * Accept the raw envelope, a bare response object, or a plain MISSION array.
 */
export function extractLogs(payload: unknown): RawLog[] {
  const candidates: unknown[] = [];

  if (Array.isArray(payload)) candidates.push(payload);
  if (isRecord(payload)) {
    candidates.push(payload.MISSION);
    const response = payload.response;
    if (isRecord(response)) candidates.push(response.MISSION);

    const data = payload.data;
    if (Array.isArray(data)) {
      for (const entry of data) {
        if (!isRecord(entry)) continue;
        candidates.push(entry.MISSION);
        const inner = entry.response;
        if (isRecord(inner)) candidates.push(inner.MISSION);
      }
    }
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0 && isRecord(candidate[0])) {
      return candidate as RawLog[];
    }
  }
  throw new Error("Payload does not contain a MISSION telemetry array.");
}

function readMeta(payload: unknown, rawLogs: RawLog[]): { uin: string; date: string } {
  let uin = "";
  const firstRaw = rawLogs[0];
  const date = firstRaw ? readString(firstRaw.date) : "";

  if (isRecord(payload)) {
    const entry = Array.isArray(payload.data) ? payload.data[0] : undefined;
    const candidates: unknown[] = [];
    if (isRecord(entry)) candidates.push(entry.response);
    candidates.push(payload.response);
    for (const candidate of candidates) {
      if (isRecord(candidate) && typeof candidate.UIN === "string") uin = candidate.UIN;
    }
  }
  if (!uin && firstRaw) uin = readString(firstRaw.UIN);

  return { uin: uin || "—", date };
}

function normalizeLog(raw: RawLog, index: number): FlightLog | null {
  const lat = num(raw.LAT ?? raw.lat);
  const lng = num(raw.LONG ?? raw.LONGITUDE ?? raw.lng ?? raw.lon);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;

  const time = readString(raw.time);
  const coveredRaw = raw.coveredarea === undefined ? null : readString(raw.coveredarea);

  return {
    key: `${index}`,
    index,
    missionId: readString(raw.MISSIONID),
    lat,
    lng,
    time,
    seconds: parseClock(time),
    mode: readString(raw.Missionmode) || "—",
    status: readString(raw.status),
    coveredAcres: parseAreaAcres(raw.coveredarea),
    coveredRaw,
    battery: num(raw.battery),
    altitude: num(raw.altitude),
    speed: num(raw.speed),
    flowRate: num(raw["flow rate"]),
    gpsCount: num(raw["gps count"]),
    heading: num(raw.heading),
  };
}

function segmentSpraying(from: FlightLog, to: FlightLog, rule: SprayRule): boolean {
  if (rule === "incremental") {
    const before = from.coveredAcres ?? 0;
    const after = to.coveredAcres ?? 0;
    return after > before + 1e-6;
  }
  // Default rule requested by the farm team: any log reporting area > 0 means the
  // pump was running, so the leg that starts at that log is drawn green.
  return (from.coveredAcres ?? 0) > 0;
}

function toRuns(segments: Segment[]): PathRun[] {
  const runs: PathRun[] = [];
  for (const segment of segments) {
    const last = runs[runs.length - 1];
    if (last && last.spraying === segment.spraying) {
      last.points.push([segment.to.lat, segment.to.lng]);
      last.toTime = segment.to.time;
      last.lengthM += segment.lengthM;
    } else {
      runs.push({
        spraying: segment.spraying,
        points: [
          [segment.from.lat, segment.from.lng],
          [segment.to.lat, segment.to.lng],
        ],
        fromTime: segment.from.time,
        toTime: segment.to.time,
        lengthM: segment.lengthM,
        startArea: segment.from.coveredAcres,
      });
    }
  }
  return runs;
}

function buildMission(id: string, logs: FlightLog[], rule: SprayRule): Mission {
  const segments: Segment[] = [];
  for (let i = 0; i < logs.length - 1; i += 1) {
    const from = logs[i];
    const to = logs[i + 1];
    if (!from || !to) continue;
    segments.push({
      from,
      to,
      lengthM: haversineMeters(from, to),
      spraying: segmentSpraying(from, to, rule),
    });
  }

  const first = logs[0];
  const last = logs[logs.length - 1];
  const distanceM = segments.reduce((sum, segment) => sum + segment.lengthM, 0);
  const sprayedDistanceM = segments.reduce(
    (sum, segment) => sum + (segment.spraying ? segment.lengthM : 0),
    0,
  );

  let areaAcres = 0;
  let maxAltitude: number | null = null;
  let speedSum = 0;
  let speedCount = 0;
  for (const log of logs) {
    if (log.coveredAcres !== null && log.coveredAcres > areaAcres) areaAcres = log.coveredAcres;
    if (log.altitude !== null) {
      maxAltitude = maxAltitude === null ? log.altitude : Math.max(maxAltitude, log.altitude);
    }
    if (log.speed !== null) {
      speedSum += log.speed;
      speedCount += 1;
    }
  }

  const mapped = id !== "";
  const startSeconds = first?.seconds ?? 0;
  const endSeconds = last?.seconds ?? 0;

  return {
    id: id || `boot-${logs[0]?.index ?? 0}`,
    label: id || "BOOT",
    logs,
    segments,
    runs: toRuns(segments),
    mapped,
    startTime: first?.time ?? "—",
    endTime: last?.time ?? "—",
    durationSec: Math.max(0, endSeconds - startSeconds),
    distanceM,
    sprayedDistanceM,
    areaAcres,
    batteryStart: first?.battery ?? null,
    batteryEnd: last?.battery ?? null,
    maxAltitude,
    avgSpeedKmh: speedCount > 0 ? (speedSum / speedCount) * 3.6 : null,
  };
}

/** Groups consecutive logs that share a mission id. */
function groupLogs(logs: FlightLog[]): Array<{ id: string; logs: FlightLog[] }> {
  const groups: Array<{ id: string; logs: FlightLog[] }> = [];
  for (const log of logs) {
    const current = groups[groups.length - 1];
    if (log.missionId && current && current.id === log.missionId) {
      current.logs.push(log);
      continue;
    }
    groups.push({ id: log.missionId, logs: [log] });
  }
  return groups;
}

export function buildDataset(payload: unknown, rule: SprayRule): Dataset {
  const rawLogs = extractLogs(payload);

  const logs: FlightLog[] = [];
  let skippedLogs = 0;
  rawLogs.forEach((raw, index) => {
    const log = normalizeLog(raw, index);
    if (log) logs.push(log);
    else skippedLogs += 1;
  });
  if (logs.length === 0) throw new Error("Telemetry was found but no usable GPS coordinates could be read.");

  const missions = groupLogs(logs)
    .map((group) => buildMission(group.id, group.logs, rule))
    .sort((a, b) => (a.logs[0]?.seconds ?? 0) - (b.logs[0]?.seconds ?? 0));

  const meta = readMeta(payload, rawLogs);
  const mappedMissions = missions.filter((mission) => mission.mapped);

  let south = Number.POSITIVE_INFINITY;
  let west = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  for (const log of logs) {
    if (log.lat < south) south = log.lat;
    if (log.lat > north) north = log.lat;
    if (log.lng < west) west = log.lng;
    if (log.lng > east) east = log.lng;
  }

  const orderedTimes = [...logs].sort((a, b) => a.seconds - b.seconds);

  return {
    uin: meta.uin,
    date: meta.date,
    missions,
    allLogs: logs,
    bounds: logs.length > 0 ? [[south, west], [north, east]] : null,
    totals: {
      missions: mappedMissions.length,
      logs: logs.length,
      distanceM: mappedMissions.reduce((sum, mission) => sum + mission.distanceM, 0),
      sprayedDistanceM: mappedMissions.reduce((sum, mission) => sum + mission.sprayedDistanceM, 0),
      areaAcres: mappedMissions.reduce((sum, mission) => sum + mission.areaAcres, 0),
      firstTime: orderedTimes[0]?.time ?? "—",
      lastTime: orderedTimes[orderedTimes.length - 1]?.time ?? "—",
      unassignedLogs: logs.length - mappedMissions.reduce((sum, mission) => sum + mission.logs.length, 0),
      skippedLogs,
    },
  };
}
