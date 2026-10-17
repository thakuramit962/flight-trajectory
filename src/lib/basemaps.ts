export type BasemapKey = "streets" | "satellite" | "dark";

export interface Basemap {
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
  /** Deepest zoom with real imagery; beyond this Leaflet upscales instead of showing blank tiles. */
  maxNativeZoom: number;
}

export const BASEMAPS: Record<BasemapKey, Basemap> = {
  streets: {
    label: "Streets",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 20,
    maxNativeZoom: 19,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 20,
    maxNativeZoom: 18,
  },
  dark: {
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    maxZoom: 20,
    maxNativeZoom: 19,
  },
};

export const SPRAY_COLOR = "#22c55e";
export const IDLE_COLOR = "#ef4444";

