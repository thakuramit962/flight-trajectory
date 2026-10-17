import { useState } from "react";
import type { Dataset, SprayRule } from "../types";
import { BASEMAPS } from "../lib/basemaps";
import type { BasemapKey } from "../lib/basemaps";
import { fmtAcres, fmtDistance, fmtDuration, fmtPercent } from "../lib/format";

interface SidebarProps {
  dataset: Dataset | null;
  open: boolean;
  hidden: Set<string>;
  selectedMissionId: string | null;
  sourceLabel: string;
  sprayRule: SprayRule;
  basemap: BasemapKey;
  showMarkers: boolean;
  token: string;
  onSelectMission: (missionId: string) => void;
  onToggleMission: (missionId: string) => void;
  onSetAllVisible: (visible: boolean) => void;
  onSprayRuleChange: (rule: SprayRule) => void;
  onBasemapChange: (key: BasemapKey) => void;
  onShowMarkersChange: (value: boolean) => void;
  onTokenChange: (value: string) => void;
  onSaveToken: () => void;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {hint ? <span className="stat__hint">{hint}</span> : null}
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  const {
    dataset,
    open,
    hidden,
    selectedMissionId,
    sourceLabel,
    sprayRule,
    basemap,
    showMarkers,
    token,
    onSelectMission,
    onToggleMission,
    onSetAllVisible,
    onSprayRuleChange,
    onBasemapChange,
    onShowMarkersChange,
    onTokenChange,
    onSaveToken,
  } = props;

  const [settingsOpen, setSettingsOpen] = useState(false);

  const missions = dataset?.missions.filter((mission) => mission.mapped) ?? [];
  const totals = dataset?.totals;
  const sprayShare =
    totals && totals.distanceM > 0 ? totals.sprayedDistanceM / totals.distanceM : 0;
  const visibleCount = missions.filter((mission) => !hidden.has(mission.id)).length;

  return (
    <aside className={`panel${open ? "" : " panel--closed"}`}>
      <div className="panel__scroll">
        {!dataset ? (
          <div className="panel__empty">
            <p className="panel__empty-title">No telemetry loaded</p>
            <p>Pick a date and UIN, or open the bundled demo data.</p>
          </div>
        ) : (
          <>
            <section className="panel__section">
              <div className="stats">
                <Stat label="Sorties" value={String(totals?.missions ?? 0)} hint={`${totals?.logs ?? 0} logs`} />
                <Stat
                  label="Flown"
                  value={fmtDistance(totals?.distanceM ?? 0)}
                  hint={`${fmtPercent(sprayShare)} spraying`}
                />
                <Stat label="Sprayed" value={fmtAcres(totals?.areaAcres ?? 0)} hint="logged per sortie" />
                <Stat
                  label="Window"
                  value={`${totals?.firstTime ?? "—"}`}
                  hint={`to ${totals?.lastTime ?? "—"}`}
                />
              </div>
              <p className="panel__source">
                <span className="dot" data-live={sourceLabel.startsWith("Live")} />
                {sourceLabel || "—"} · {dataset.date || "date n/a"}
              </p>
            </section>

            <section className="panel__section">
              <div className="section-head">
                <h2>
                  Missions <span className="section-head__count">{missions.length}</span>
                </h2>
                <div className="section-head__actions">
                  <button type="button" className="link-btn" onClick={() => onSetAllVisible(true)}>
                    All
                  </button>
                  <button type="button" className="link-btn" onClick={() => onSetAllVisible(false)}>
                    None
                  </button>
                </div>
              </div>

              <div className="mission-list">
                {missions.map((mission) => {
                  const isHidden = hidden.has(mission.id);
                  const selected = mission.id === selectedMissionId;
                  const share =
                    mission.distanceM > 0 ? mission.sprayedDistanceM / mission.distanceM : 0;
                  return (
                    <div
                      key={mission.id}
                      className="mission"
                      data-selected={selected}
                      data-hidden={isHidden}
                    >
                      <button
                        type="button"
                        className="mission__main"
                        onClick={() => onSelectMission(mission.id)}
                      >
                        <span
                          className="mission__bar"
                          data-spray={mission.areaAcres > 0}
                          aria-hidden="true"
                        />
                        <span className="mission__body">
                          <span className="mission__row">
                            <span className="mission__id">{mission.id}</span>
                            <span className="mission__clock">
                              {mission.startTime}–{mission.endTime}
                            </span>
                          </span>
                          <span className="mission__meta">
                            {fmtDistance(mission.distanceM)} · {fmtDuration(mission.durationSec)} ·{" "}
                            {fmtAcres(mission.areaAcres)}
                          </span>
                          <span className="mission__track" aria-hidden="true">
                            <span style={{ width: `${Math.min(100, share * 100)}%` }} />
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="mission__eye"
                        aria-label={isHidden ? `Show ${mission.id}` : `Hide ${mission.id}`}
                        aria-pressed={!isHidden}
                        onClick={() => onToggleMission(mission.id)}
                      >
                        {isHidden ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M3 3l18 18" strokeLinecap="round" />
                            <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3.2 3.6M6.3 7.9A17 17 0 0 0 3 12s4 6 9 6c1.3 0 2.5-.4 3.6-1" strokeLinecap="round" />
                            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M2.5 12S6.5 6 12 6s9.5 6 9.5 6-4 6-9.5 6-9.5-6-9.5-6Z" />
                            <circle cx="12" cy="12" r="2.8" />
                          </svg>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="panel__footnote">
                {visibleCount} of {missions.length} paths shown
                {totals && totals.unassignedLogs > 0
                  ? ` · ${totals.unassignedLogs} BOOT records without a mission id are not mapped`
                  : ""}
              </p>
            </section>

            <section className="panel__section">
              <button
                type="button"
                className="settings-toggle"
                onClick={() => setSettingsOpen((value) => !value)}
                aria-expanded={settingsOpen}
              >
                <span>Map &amp; data settings</span>
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ transform: settingsOpen ? "rotate(180deg)" : "none", transition: "transform .18s" }}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {settingsOpen ? (
                <div className="settings">
                  <div className="setting">
                    <span className="setting__label">Spray detection</span>
                    <select
                      value={sprayRule}
                      onChange={(event) => onSprayRuleChange(event.target.value as SprayRule)}
                    >
                      <option value="cumulative">Leg starts at a log with area &gt; 0</option>
                      <option value="incremental">Area increased on that leg</option>
                    </select>
                    <span className="setting__hint">
                      Default rule: green when the log starting a leg reports coveredarea above zero.
                    </span>
                  </div>

                  <div className="setting">
                    <span className="setting__label">Basemap</span>
                    <div className="segmented" role="group" aria-label="Basemap">
                      {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
                        <button
                          key={key}
                          type="button"
                          data-active={basemap === key}
                          onClick={() => onBasemapChange(key)}
                        >
                          {BASEMAPS[key].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="setting setting--switch">
                    <span className="setting__label">Start markers</span>
                    <input
                      type="checkbox"
                      checked={showMarkers}
                      onChange={(event) => onShowMarkersChange(event.target.checked)}
                    />
                  </label>

                  <div className="setting">
                    <span className="setting__label">API bearer token</span>
                    <textarea
                      rows={3}
                      value={token}
                      onChange={(event) => onTokenChange(event.target.value)}
                      placeholder="Optional: paste a JWT to override the server proxy"
                      spellCheck={false}
                    />
                    <div className="setting__row">
                      <span className="setting__hint">
                        Hosted builds use a server-side proxy. A token here overrides it in this
                        browser only.
                      </span>
                      <button type="button" className="btn btn--small" onClick={onSaveToken}>
                        Save &amp; reload
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
