import type { ChangeEvent, FormEvent } from "react";

interface HeaderProps {
  uin: string;
  dateIso: string;
  loading: boolean;
  onUinChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onSubmit: () => void;
  onLoadSample: () => void;
  onImportFile: (file: File) => void;
  onTogglePanel: () => void;
}

export function Header({
  uin,
  dateIso,
  loading,
  onUinChange,
  onDateChange,
  onSubmit,
  onLoadSample,
  onImportFile,
  onTogglePanel,
}: HeaderProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onImportFile(file);
    event.target.value = "";
  }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 21c0-4.5 2.5-8 7-9-1 5.5-3.4 8-7 9Z" strokeLinejoin="round" />
            <path d="M12 21C12 16.5 9.5 13 5 12c1 5.5 3.4 8 7 9Z" strokeLinejoin="round" />
            <path d="M12 21V9" strokeLinecap="round" />
            <circle cx="12" cy="5" r="2.2" />
          </svg>
        </span>
        <span className="brand__text">
          <span className="brand__title">Agri Flight Map</span>
          <span className="brand__sub">Daily spray-path telemetry</span>
        </span>
      </div>

      <form className="query" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Date</span>
          <input
            type="date"
            value={dateIso}
            onChange={(event) => onDateChange(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Drone UIN</span>
          <input
            type="text"
            value={uin}
            onChange={(event) => onUinChange(event.target.value)}
            placeholder="UA00FUGD0TC"
            spellCheck={false}
            required
          />
        </label>
        <button className="btn btn--primary" type="submit" disabled={loading}>
          {loading ? "Loading…" : "Load flights"}
        </button>
      </form>

      <div className="topbar__actions">
        <button className="btn btn--ghost" type="button" onClick={onLoadSample}>
          Demo data
        </button>
        <label className="btn btn--ghost btn--file">
          Import JSON
          <input type="file" accept="application/json,.json" onChange={handleFile} hidden />
        </label>
        <button className="btn btn--icon" type="button" onClick={onTogglePanel} aria-label="Toggle panel">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <path d="M15 4v16" />
          </svg>
        </button>
      </div>
    </header>
  );
}
