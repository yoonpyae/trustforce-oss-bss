// Server-renderable SVG charts, ported from the legacy static demo's TF.ui
// chart helpers (assets/js/core/ui.js) as pure components.

type Series = { points: number[]; color?: string; fill?: boolean };

export function LineChart({
  series,
  labels,
  height = 180,
  fmtY,
  label,
}: {
  series: Series[];
  labels?: string[];
  height?: number;
  fmtY?: (v: number) => string;
  label?: string;
}) {
  const w = 640,
    ht = height,
    pl = 44,
    pr = 8,
    pt = 12,
    pb = 22;
  const all = series.reduce((a: number[], s) => a.concat(s.points), []);
  const max = Math.max(...all) * 1.12 || 1;
  const min = Math.min(0, Math.min(...all));
  const n = series[0]?.points.length || 1;
  const x = (i: number) => pl + (i * (w - pl - pr)) / Math.max(1, n - 1);
  const y = (v: number) => pt + (ht - pt - pb) * (1 - (v - min) / (max - min || 1));

  return (
    <svg viewBox={`0 0 ${w} ${ht}`} className="spark" role="img" aria-label={label || "chart"}>
      {[0, 1, 2, 3].map((g) => {
        const gv = min + ((max - min) * g) / 3;
        return (
          <g key={g}>
            <line x1={pl} x2={w - pr} y1={y(gv)} y2={y(gv)} stroke="var(--line-soft)" strokeWidth={1} />
            <text x={6} y={y(gv) + 4} fill="var(--text-mute)" fontSize={10}>
              {fmtY ? fmtY(gv) : Math.round(gv).toLocaleString()}
            </text>
          </g>
        );
      })}
      {series.map((s, si) => {
        const d = s.points.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p).toFixed(1)).join(" ");
        const color = s.color || "var(--cyan)";
        return (
          <g key={si}>
            {s.fill !== false && (
              <path d={d + ` L ${x(n - 1)} ${y(min)} L ${x(0)} ${y(min)} Z`} fill={color} opacity={0.1} />
            )}
            <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      })}
      {(labels || []).map((lb, i) => {
        if ((labels?.length || 0) > 12 && i % 3 !== 0) return null;
        return (
          <text key={i} x={x(i)} y={ht - 6} fill="var(--text-mute)" fontSize={10} textAnchor="middle">
            {lb}
          </text>
        );
      })}
    </svg>
  );
}

export function BarChart({
  items,
  height = 200,
  fmtY,
}: {
  items: { label: string; value: number; color?: string }[];
  height?: number;
  fmtY?: (v: number) => string;
}) {
  const w = 640,
    ht = height,
    pl = 48,
    pr = 8,
    pt = 10,
    pb = 26;
  const max = Math.max(...items.map((i) => i.value)) * 1.1 || 1;
  const bw = (w - pl - pr) / items.length;

  return (
    <svg viewBox={`0 0 ${w} ${ht}`} className="spark">
      {[0, 1, 2, 3].map((g) => {
        const gv = (max * g) / 3;
        const yy = pt + (ht - pt - pb) * (1 - gv / max);
        return (
          <g key={g}>
            <line x1={pl} x2={w - pr} y1={yy} y2={yy} stroke="var(--line-soft)" />
            <text x={6} y={yy + 4} fill="var(--text-mute)" fontSize={10}>
              {fmtY ? fmtY(gv) : Math.round(gv).toLocaleString()}
            </text>
          </g>
        );
      })}
      {items.map((it, i) => {
        const hgt = ((ht - pt - pb) * it.value) / max;
        return (
          <g key={i}>
            <rect
              x={pl + i * bw + bw * 0.18}
              y={pt + (ht - pt - pb) - hgt}
              width={bw * 0.64}
              height={Math.max(1, hgt)}
              rx={3}
              fill={it.color || "var(--cyan-deep)"}
            />
            <text x={pl + i * bw + bw / 2} y={ht - 8} fill="var(--text-mute)" fontSize={10} textAnchor="middle">
              {it.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({
  slices,
  center,
  sub,
}: {
  slices: { value: number; color: string }[];
  center?: string | number;
  sub?: string;
}) {
  const size = 150,
    r = 58,
    cx = size / 2,
    cy = size / 2,
    C = 2 * Math.PI * r;
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  let off = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {slices.map((s, i) => {
        const len = (s.value / total) * C;
        const el = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={16}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-off}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        off += len;
        return el;
      })}
      <text x={cx} y={cy + 2} textAnchor="middle" fill="var(--text)" fontSize={22} fontFamily="var(--font-head)">
        {center ?? total}
      </text>
      {sub && (
        <text x={cx} y={cy + 18} textAnchor="middle" fill="var(--text-mute)" fontSize={10}>
          {sub}
        </text>
      )}
    </svg>
  );
}
