import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Dataset, Mission } from "../types";
import { fmtAcres, fmtDistance } from "../lib/format";
import { BASEMAPS, IDLE_COLOR, SPRAY_COLOR } from "../lib/basemaps";
import type { BasemapKey } from "../lib/basemaps";

interface FocusRequest {
  missionId: string | null;
  token: number;
}

interface MapViewProps {
  dataset: Dataset | null;
  visibleMissionIds: string[];
  selectedMissionId: string | null;
  basemap: BasemapKey;
  showMarkers: boolean;
  focus: FocusRequest;
  onSelectMission: (missionId: string | null) => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function runTooltip(
  mission: Mission,
  spraying: boolean,
  from: string,
  to: string,
  lengthM: number,
  startArea: number | null,
): string {
  const state = spraying ? "Spraying" : "No spray";
  const area = startArea !== null ? ` · ${fmtAcres(startArea)} so far` : "";
  return [
    '<div class="map-tip">',
    `<span class="map-tip__id">${escapeHtml(mission.id)}</span>`,
    `<span class="map-tip__row">${escapeHtml(from)} → ${escapeHtml(to)}</span>`,
    `<span class="map-tip__row map-tip__state" data-spray="${spraying}">${state} · ${fmtDistance(lengthM)}${area}</span>`,
    "</div>",
  ].join("");
}

export function MapView({
  dataset,
  visibleMissionIds,
  selectedMissionId,
  basemap,
  showMarkers,
  focus,
  onSelectMission,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);

  // Keep the newest callback available to handlers created once (map click).
  const selectRef = useRef(onSelectMission);
  useEffect(() => {
    selectRef.current = onSelectMission;
  }, [onSelectMission]);

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: true,
      center: [22.5, 80],
      zoom: 4,
      worldCopyJump: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomleft", imperial: false, maxWidth: 120 }).addTo(map);
    map.attributionControl.setPrefix(
      '<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>',
    );

    map.on("click", () => selectRef.current(null));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
  }, []);

  // Keep Leaflet in sync with layout changes (sidebar collapse, window resize).
  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;
    if (!container || !map) return;
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Basemap switching.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const config = BASEMAPS[basemap];
    if (tileRef.current) map.removeLayer(tileRef.current);
    const layer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      maxNativeZoom: config.maxNativeZoom,
      crossOrigin: true,
    });
    layer.addTo(map);
    layer.bringToBack();
    tileRef.current = layer;
  }, [basemap]);

  // Draw the flight paths.
  const visibleKey = visibleMissionIds.join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dataset) return;

    const group = L.layerGroup().addTo(map);
    const visible = new Set(visibleMissionIds);

    for (const mission of dataset.missions) {
      if (!mission.mapped || !visible.has(mission.id) || mission.runs.length === 0) continue;

      const isSelected = mission.id === selectedMissionId;
      const dimmed = selectedMissionId !== null && !isSelected;

      for (const run of mission.runs) {
        const line = L.polyline(run.points, {
          color: run.spraying ? SPRAY_COLOR : IDLE_COLOR,
          weight: isSelected ? 6 : 4,
          opacity: dimmed ? 0.25 : 0.95,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1,
          interactive: true,
          bubblingMouseEvents: false,
          className: run.spraying ? "path-run path-run--spray" : "path-run path-run--idle",
        });

        line.bindTooltip(runTooltip(mission, run.spraying, run.fromTime, run.toTime, run.lengthM, run.startArea), {
          sticky: true,
          direction: "top",
          className: "flight-tooltip",
          opacity: 1,
        });

        line.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          onSelectMission(mission.id);
        });

        line.addTo(group);
      }

      if (showMarkers) {
        const first = mission.logs[0];
        const last = mission.logs[mission.logs.length - 1];
        if (!first || !last) continue;

        const start = L.circleMarker([first.lat, first.lng], {
          radius: isSelected ? 6 : 4,
          color: "#e6edf7",
          weight: 1.5,
          fillColor: "#0b1220",
          fillOpacity: 0.85,
          opacity: dimmed ? 0.4 : 1,
          bubblingMouseEvents: false,
        }).addTo(group);

        start.bindTooltip(
          `<div class="map-tip"><span class="map-tip__id">${escapeHtml(mission.id)}</span><span class="map-tip__row">Start ${escapeHtml(mission.startTime)}</span><span class="map-tip__row">${fmtDistance(mission.distanceM)} flown</span></div>`,
          { direction: "top", className: "flight-tooltip", opacity: 1 },
        );
        start.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          onSelectMission(mission.id);
        });

        if (isSelected) {
          L.circleMarker([last.lat, last.lng], {
            radius: 6,
            color: "#e6edf7",
            weight: 1.5,
            fillColor: mission.areaAcres > 0 ? SPRAY_COLOR : IDLE_COLOR,
            fillOpacity: 1,
            bubblingMouseEvents: false,
          })
            .bindTooltip(`End ${escapeHtml(mission.endTime)}`, {
              direction: "top",
              className: "flight-tooltip",
              opacity: 1,
            })
            .addTo(group);
        }
      }
    }

    return () => {
      group.remove();
    };
  }, [dataset, visibleKey, visibleMissionIds, selectedMissionId, showMarkers, onSelectMission]);

  // Fit the viewport to the requested mission, or to the whole dataset.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dataset) return;

    const target = focus.missionId
      ? dataset.missions.find((mission) => mission.id === focus.missionId)
      : undefined;

    if (target && target.logs.length > 0) {
      const bounds = L.latLngBounds(target.logs.map((log) => [log.lat, log.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.25), { animate: true, maxZoom: 20 });
      return;
    }
    if (dataset.bounds) {
      map.fitBounds(L.latLngBounds(dataset.bounds), {
        padding: [36, 36],
        animate: true,
        maxZoom: 19,
      });
    }
  }, [dataset, focus.token, focus.missionId]);

  return <div ref={containerRef} className="map-canvas" aria-label="Flight path map" />;
}
