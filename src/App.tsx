import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Header } from "./components/Header";
import { Legend } from "./components/Legend";
import { MapView } from "./components/MapView";
import type { BasemapKey } from "./lib/basemaps";
import { Sidebar } from "./components/Sidebar";
import { config, saveRuntimeToken } from "./config";
import { fetchDailyData, loadSampleData, toApiDate } from "./lib/api";
import { buildDataset } from "./lib/dataset";
import type { Dataset, SprayRule } from "./types";

type StatusKind = "idle" | "loading" | "error" | "notice";

interface Status {
  kind: StatusKind;
  message: string;
}

export default function App() {
  const [uin, setUin] = useState(config.uin);
  const [dateIso, setDateIso] = useState(config.date);
  const [token, setToken] = useState(config.token);

  const [payload, setPayload] = useState<unknown>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "loading", message: "Loading telemetry…" });

  const [sprayRule, setSprayRule] = useState<SprayRule>("cumulative");
  const [basemap, setBasemap] = useState<BasemapKey>("satellite");
  const [showMarkers, setShowMarkers] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ missionId: string | null; token: number }>({
    missionId: null,
    token: 0,
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const bootedRef = useRef(false);

  const parsed = useMemo(() => {
    if (!payload) return { dataset: null as Dataset | null, error: null as string | null };
    try {
      return { dataset: buildDataset(payload, sprayRule), error: null as string | null };
    } catch (error) {
      return {
        dataset: null as Dataset | null,
        error: error instanceof Error ? error.message : "Could not read this telemetry payload.",
      };
    }
  }, [payload, sprayRule]);

  const dataset = parsed.dataset;
  const parseError = parsed.error;

  const applyPayload = useCallback((next: unknown, label: string) => {
    setDismissed(null);
    setPayload(next);
    setSourceLabel(label);
    setHidden(new Set());
    setSelectedMissionId(null);
    setFocus((current) => ({ missionId: null, token: current.token + 1 }));
  }, []);

  const loadApi = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const id = ++requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setDismissed(null);
    setStatus({ kind: "loading", message: "Fetching telemetry from the API…" });

    try {
      const apiDate = toApiDate(dateIso);
      const json = await fetchDailyData({
        uin,
        apiDate,
        token,
        signal: controller.signal,
      });
      if (id !== requestId.current) return { ok: false };
      applyPayload(json, `Live API · ${uin.trim()}`);
      setStatus({ kind: "idle", message: `Loaded ${apiDate} for ${uin.trim()}.` });
      return { ok: true };
    } catch (error) {
      if (controller.signal.aborted) return { ok: false };
      const message = error instanceof Error ? error.message : "Could not load telemetry.";
      setStatus({ kind: "error", message });
      return { ok: false, error: message };
    }
  }, [applyPayload, dateIso, token, uin]);

  const loadSample = useCallback(async () => {
    requestId.current += 1;
    abortRef.current?.abort();
    setDismissed(null);
    setStatus({ kind: "loading", message: "Opening bundled demo data…" });
    try {
      const json = await loadSampleData();
      applyPayload(json, "Demo data · UA00FUGD0TC");
      setStatus({
        kind: "notice",
        message: "Showing bundled demo telemetry. Press “Load flights” for live data.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not open the demo data.",
      });
    }
  }, [applyPayload]);

  // First load: try the live API, fall back to the bundled sample so the map is never empty.
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    void (async () => {
      const result = await loadApi();
      if (!result.ok) {
        await loadSample();
        setStatus({
          kind: "notice",
          message: `Live API unavailable (${result.error ?? "request failed"}). Showing bundled demo data for 16-10-2026.`,
        });
      }
    })();

    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importFile = useCallback(
    async (file: File) => {
      setDismissed(null);
      try {
        const text = await file.text();
        const json: unknown = JSON.parse(text);
        applyPayload(json, `Imported · ${file.name}`);
        setStatus({ kind: "idle", message: `Loaded ${file.name}.` });
      } catch {
        setStatus({ kind: "error", message: `${file.name} is not a valid JSON payload.` });
      }
    },
    [applyPayload],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) void importFile(file);
    },
    [importFile],
  );

  const missions = useMemo(
    () => dataset?.missions.filter((mission) => mission.mapped) ?? [],
    [dataset],
  );

  const visibleMissionIds = useMemo(
    () => missions.filter((mission) => !hidden.has(mission.id)).map((mission) => mission.id),
    [missions, hidden],
  );

  const selectFromList = useCallback((missionId: string) => {
    setSelectedMissionId(missionId);
    setFocus((current) => ({ missionId, token: current.token + 1 }));
  }, []);

  const selectFromMap = useCallback((missionId: string | null) => {
    setSelectedMissionId(missionId);
  }, []);

  const toggleMission = useCallback((missionId: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(missionId)) next.delete(missionId);
      else next.add(missionId);
      return next;
    });
  }, []);

  const setAllVisible = useCallback(
    (visible: boolean) => {
      setHidden(visible ? new Set() : new Set(missions.map((mission) => mission.id)));
    },
    [missions],
  );

  const saveToken = useCallback(() => {
    saveRuntimeToken(token);
    void loadApi();
  }, [loadApi, token]);

  const legendMeta = dataset
    ? `${dataset.uin} · ${dataset.date || "date n/a"} · ${dataset.totals.logs.toLocaleString()} logs`
    : null;

  const banner = parseError ? { kind: "error" as const, message: parseError } : status;
  const showBanner =
    (banner.kind === "error" || banner.kind === "notice") && banner.message !== dismissed;

  return (
    <div className="app">
      <Header
        uin={uin}
        dateIso={dateIso}
        loading={status.kind === "loading"}
        onUinChange={setUin}
        onDateChange={setDateIso}
        onSubmit={() => void loadApi()}
        onLoadSample={() => void loadSample()}
        onImportFile={(file) => void importFile(file)}
        onTogglePanel={() => setPanelOpen((value) => !value)}
      />

      <main
        className={`workspace${dragging ? " workspace--drag" : ""}${panelOpen ? "" : " workspace--panel-closed"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="map-wrap">
          <MapView
            dataset={dataset}
            visibleMissionIds={visibleMissionIds}
            selectedMissionId={selectedMissionId}
            basemap={basemap}
            showMarkers={showMarkers}
            focus={focus}
            onSelectMission={selectFromMap}
          />

          <Legend meta={legendMeta} />

          {status.kind === "loading" ? (
            <div className="loading" role="status">
              <span className="spinner" aria-hidden="true" />
              <span>{status.message}</span>
            </div>
          ) : null}

          {showBanner ? (
            <div className={`banner banner--${banner.kind}`} role="alert">
              <span className="banner__text">{banner.message}</span>
              <button
                type="button"
                className="banner__close"
                aria-label="Dismiss message"
                onClick={() => setDismissed(banner.message)}
              >
                ×
              </button>
            </div>
          ) : null}

          {dragging ? (
            <div className="drop-overlay">
              <span>Drop a telemetry JSON file to map it</span>
            </div>
          ) : null}
        </div>

        <Sidebar
          dataset={dataset}
          open={panelOpen}
          hidden={hidden}
          selectedMissionId={selectedMissionId}
          sourceLabel={sourceLabel}
          sprayRule={sprayRule}
          basemap={basemap}
          showMarkers={showMarkers}
          token={token}
          onSelectMission={selectFromList}
          onToggleMission={toggleMission}
          onSetAllVisible={setAllVisible}
          onSprayRuleChange={setSprayRule}
          onBasemapChange={setBasemap}
          onShowMarkersChange={setShowMarkers}
          onTokenChange={setToken}
          onSaveToken={saveToken}
        />
      </main>
    </div>
  );
}
