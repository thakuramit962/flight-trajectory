interface LegendProps {
  meta: string | null;
}

export function Legend({ meta }: LegendProps) {
  return (
    <div className="legend">
      <span className="legend__title">Path colour</span>
      <span className="legend__row">
        <i className="legend__swatch legend__swatch--spray" />
        Spraying · coveredarea &gt; 0
      </span>
      <span className="legend__row">
        <i className="legend__swatch legend__swatch--idle" />
        No spray · coveredarea = 0
      </span>
      <span className="legend__note">Colour follows the leg starting at each log</span>
      {meta ? <span className="legend__meta">{meta}</span> : null}
    </div>
  );
}
