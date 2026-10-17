/** Raw record returned by the flight telemetry API (all values arrive as strings). */
export type RawLog = Record<string, unknown>;

export type FlightMode = "ARMED" | "INFLIGHT" | "FLIGHTEND" | "BOOT" | string;

/** A single normalized telemetry log. */
export interface FlightLog {
  key: string;
  index: number;
  missionId: string;
  lat: number;
  lng: number;
  /** HH:mm:ss as reported by the drone. */
  time: string;
  /** Seconds since midnight, used for ordering and durations. */
  seconds: number;
  mode: FlightMode;
  status: string;
  /** Cumulative sprayed area for this mission, in acres. `null` when not reported. */
  coveredAcres: number | null;
  /** Raw coveredarea string, e.g. "0.42 Acre". */
  coveredRaw: string | null;
  battery: number | null;
  altitude: number | null;
  speed: number | null;
  flowRate: number | null;
  gpsCount: number | null;
  heading: number | null;
}

export type SprayRule = "cumulative" | "incremental";

export interface Segment {
  from: FlightLog;
  to: FlightLog;
  lengthM: number;
  /** True when the drone was spraying on this leg. */
  spraying: boolean;
}

/** Consecutive segments sharing the same colour, merged for rendering. */
export interface PathRun {
  spraying: boolean;
  points: Array<[number, number]>;
  fromTime: string;
  toTime: string;
  lengthM: number;
  /** Cumulative area reported at the first log of the run, in acres. */
  startArea: number | null;
}

export interface Mission {
  id: string;
  label: string;
  logs: FlightLog[];
  segments: Segment[];
  runs: PathRun[];
  /** False for single-record telemetry with no mission id (BOOT records). */
  mapped: boolean;
  startTime: string;
  endTime: string;
  durationSec: number;
  distanceM: number;
  sprayedDistanceM: number;
  areaAcres: number;
  batteryStart: number | null;
  batteryEnd: number | null;
  maxAltitude: number | null;
  avgSpeedKmh: number | null;
}

export interface Dataset {
  uin: string;
  date: string;
  missions: Mission[];
  allLogs: FlightLog[];
  bounds: [[number, number], [number, number]] | null;
  totals: {
    missions: number;
    logs: number;
    distanceM: number;
    sprayedDistanceM: number;
    areaAcres: number;
    firstTime: string;
    lastTime: string;
    unassignedLogs: number;
    skippedLogs: number;
  };
}
