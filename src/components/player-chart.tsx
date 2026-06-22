export function PlayerChart({ data }: { data: { contest: string; score: number }[] }) {
  const width = 640;
  const height = 260;
  const padding = 34;
  const values = data.length ? data : [{ contest: "Base", score: 0 }];
  const min = Math.min(...values.map((point) => point.score));
  const max = Math.max(...values.map((point) => point.score));
  const range = Math.max(1, max - min);
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const points = values.map((point, index) => {
    const x = padding + index * step;
    const y = height - padding - ((point.score - min) / range) * (height - padding * 2);
    return { ...point, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const ticks = [min, Math.round((min + max) / 2), max];

  return (
    <div className="h-full min-h-60 w-full overflow-x-auto overflow-y-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Player performance chart" className="h-full min-w-[640px]">
        <defs>
          <linearGradient id="player-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8E2BFF" stopOpacity=".55" />
            <stop offset="100%" stopColor="#8E2BFF" stopOpacity=".06" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((lineIndex) => {
          const y = padding + ((height - padding * 2) / 3) * lineIndex;
          return <line key={lineIndex} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#27272a" strokeWidth="1" />;
        })}
        <polygon points={area} fill="url(#player-chart-fill)" />
        <polyline points={line} fill="none" stroke="#9AFF00" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point) => (
          <g key={`${point.contest}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r="4" fill="#050505" stroke="#9AFF00" strokeWidth="2" />
            <title>{`${point.contest}: ${point.score}`}</title>
          </g>
        ))}
        {ticks.map((tick, index) => (
          <text key={`${tick}-${index}`} x={8} y={height - padding - ((tick - min) / range) * (height - padding * 2) + 4} fill="#71717a" fontSize="11">
            {tick}
          </text>
        ))}
        {points.filter((_, index) => index === 0 || index === points.length - 1).map((point) => (
          <text key={`${point.contest}-label`} x={point.x} y={height - 9} textAnchor={point.x > width / 2 ? "end" : "start"} fill="#71717a" fontSize="11">
            {point.contest}
          </text>
        ))}
      </svg>
    </div>
  );
}
