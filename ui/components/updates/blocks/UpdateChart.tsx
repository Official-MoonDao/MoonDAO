import type { ReactNode } from 'react'
import type {
  BarsChart,
  ChartSpec,
  DotsChart,
  LineChart,
  ScatterChart,
  StackChart,
} from '@/lib/updates/blocks'
import Figure, { type LegendItem } from './Figure'

/**
 * Every chart is drawn twice, at a wide and a narrow layout width, and CSS
 * shows one. Both are server-rendered, so there is no layout shift and no
 * client-side measuring, and phone text stays legible instead of scaling down.
 */
const WIDE = 720
const NARROW = 400

const AXIS = '#64748b'
const GRID = 'rgba(255,255,255,0.07)'
const LABEL = '#cbd5e1'
const BG = '#070b18'
const FALLBACK = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#22d3ee', '#94a3b8']

const color = (c: string | undefined, i: number) => c || FALLBACK[i % FALLBACK.length]
const fmt = (v: number, unit = '') => `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`

function ticks(min: number, max: number, target = 6): number[] {
  const raw = (max - min) / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6))
  return out
}

function Svg({
  w,
  height,
  label,
  children,
}: {
  w: number
  height: number
  label?: string
  children: ReactNode
}) {
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      role="img"
      aria-label={label}
      className="h-auto w-full"
      fontFamily="inherit"
    >
      {children}
    </svg>
  )
}

function Responsive({ render }: { render: (w: number) => ReactNode }) {
  return (
    <>
      <div className="hidden sm:block">{render(WIDE)}</div>
      <div className="sm:hidden">{render(NARROW)}</div>
    </>
  )
}

function Dots({ spec, w }: { spec: DotsChart; w: number }) {
  const narrow = w < 500
  const left = narrow ? 112 : 168
  const right = w - (narrow ? 12 : 24)
  const rowH = narrow ? 40 : 46
  const top = 28
  const max = spec.max ?? Math.max(...spec.rows.flatMap((r) => [...r.values, r.marker ?? 0])) * 1.1
  const x = (v: number) => left + (v / max) * (right - left)
  const height = top + spec.rows.length * rowH + 8
  const unit = spec.unit || ''
  const dot = narrow ? 5.5 : 6.5
  return (
    <Svg w={w} height={height} label={spec.title}>
      {ticks(0, max, narrow ? 4 : 6).map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={top - 6} y2={height - 8} stroke={GRID} />
          <text x={x(t)} y={top - 12} fill={AXIS} fontSize={11} textAnchor="middle">
            {fmt(t, unit)}
          </text>
        </g>
      ))}
      {spec.rows.map((row, r) => {
        const cy = top + r * rowH + rowH / 2
        const lo = Math.min(...row.values)
        const hi = Math.max(...row.values)
        return (
          <g key={row.label}>
            {r > 0 && (
              <line
                x1={0}
                x2={w}
                y1={cy - rowH / 2}
                y2={cy - rowH / 2}
                stroke="rgba(255,255,255,0.04)"
              />
            )}
            <text x={0} y={cy + 4} fill={LABEL} fontSize={narrow ? 12.5 : 14} fontWeight={500}>
              {row.label}
            </text>
            <rect
              x={x(lo) - dot - 2.5}
              y={cy - dot - 2.5}
              width={x(hi) - x(lo) + 2 * dot + 5}
              height={2 * dot + 5}
              rx={dot + 2.5}
              fill="rgba(148,163,184,0.14)"
            />
            {row.marker !== undefined && (
              <g>
                <rect
                  x={x(row.marker) - 1.5}
                  y={cy - 15}
                  width={3}
                  height={30}
                  rx={1.5}
                  fill="#ffffff"
                />
                <title>{`${spec.marker?.name || 'Marker'}: ${fmt(row.marker, unit)}`}</title>
              </g>
            )}
            {row.values.map((v, i) => (
              <circle
                key={i}
                cx={x(v)}
                cy={cy}
                r={dot}
                fill={color(spec.series[i].color, i)}
                stroke={BG}
                strokeWidth={2}
                fillOpacity={0.95}
              >
                <title>{`${spec.series[i].name}: ${fmt(v, unit)}`}</title>
              </circle>
            ))}
          </g>
        )
      })}
    </Svg>
  )
}

function Scatter({ spec, w }: { spec: ScatterChart; w: number }) {
  const narrow = w < 500
  const l = narrow ? 46 : 64
  const r = w - (narrow ? 14 : 30)
  const t = 20
  const b = narrow ? 280 : 330
  const height = b + 52
  const x = (v: number) => l + ((v - spec.x.min) / (spec.x.max - spec.x.min)) * (r - l)
  const y = (v: number) => b - ((v - spec.y.min) / (spec.y.max - spec.y.min)) * (b - t)
  const unit = spec.unit || ''
  const clipId = `scatter-${w}`
  let trend: [number, number, number, number] | null = null
  if (spec.trend && spec.points.length > 2) {
    const n = spec.points.length
    const mx = spec.points.reduce((s, p) => s + p.x, 0) / n
    const my = spec.points.reduce((s, p) => s + p.y, 0) / n
    const sxx = spec.points.reduce((s, p) => s + (p.x - mx) ** 2, 0)
    const slope = sxx ? spec.points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx : 0
    const at = (v: number) => my + slope * (v - mx)
    trend = [x(spec.x.min), y(at(spec.x.min)), x(spec.x.max), y(at(spec.x.max))]
  }
  return (
    <Svg w={w} height={height} label={spec.title}>
      <defs>
        <clipPath id={clipId}>
          <rect x={l} y={t} width={r - l} height={b - t} />
        </clipPath>
      </defs>
      {ticks(spec.y.min, spec.y.max, 5).map((v) => (
        <g key={`y${v}`}>
          <line x1={l} x2={r} y1={y(v)} y2={y(v)} stroke={GRID} />
          <text x={l - 8} y={y(v) + 4} fill={AXIS} fontSize={11} textAnchor="end">
            {fmt(v, unit)}
          </text>
        </g>
      ))}
      {ticks(spec.x.min, spec.x.max, narrow ? 3 : 6).map((v) => (
        <g key={`x${v}`}>
          <line x1={x(v)} x2={x(v)} y1={t} y2={b} stroke={GRID} />
          <text x={x(v)} y={b + 18} fill={AXIS} fontSize={11} textAnchor="middle">
            {fmt(v, unit)}
          </text>
        </g>
      ))}
      <text x={(l + r) / 2} y={b + 42} fill={LABEL} fontSize={narrow ? 11 : 12} textAnchor="middle">
        {spec.x.label} →
      </text>
      <text
        x={-((t + b) / 2)}
        y={14}
        fill={LABEL}
        fontSize={12}
        textAnchor="middle"
        transform="rotate(-90)"
      >
        {spec.y.label} →
      </text>
      {trend && (
        <line
          x1={trend[0]}
          y1={trend[1]}
          x2={trend[2]}
          y2={trend[3]}
          stroke="rgba(255,255,255,0.35)"
          strokeDasharray="5 6"
          strokeWidth={1.5}
          clipPath={`url(#${clipId})`}
        />
      )}
      {spec.points.map((p, i) => {
        const cx = x(p.x)
        const cy = y(p.y)
        const anchor = p.anchor || 'right'
        const dx = anchor === 'left' ? -20 : anchor === 'right' ? 20 : 0
        const dy = anchor === 'top' ? -22 : anchor === 'bottom' ? 30 : 5
        const ta = anchor === 'left' ? 'end' : anchor === 'right' ? 'start' : 'middle'
        return (
          <g key={p.label}>
            <circle
              cx={cx}
              cy={cy}
              r={narrow ? 12 : 16}
              fill={color(p.color, i)}
              fillOpacity={0.15}
            />
            <circle
              cx={cx}
              cy={cy}
              r={narrow ? 6 : 7}
              fill={color(p.color, i)}
              stroke={BG}
              strokeWidth={2}
            />
            <text
              x={cx + dx}
              y={cy + dy}
              fill="#ffffff"
              fontSize={13}
              fontWeight={600}
              textAnchor={ta}
              stroke={BG}
              strokeWidth={5}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {p.label}
              {!narrow && (
                <tspan fill={AXIS} fontWeight={400}>{`  ${fmt(p.x, unit)}, ${fmt(
                  p.y,
                  unit
                )}`}</tspan>
              )}
            </text>
          </g>
        )
      })}
    </Svg>
  )
}

function Bars({ spec, w }: { spec: BarsChart; w: number }) {
  const narrow = w < 500
  const labelW = narrow ? 70 : 96
  const gap = 36
  const rowH = narrow ? 34 : 40
  const head = 30
  const perRow = narrow ? 1 : spec.panels.length
  const panelW = (w - labelW - gap * (perRow - 1)) / perRow
  const panelH = head + spec.rows.length * rowH
  const height = (narrow ? spec.panels.length * (panelH + 14) : panelH) + 4
  return (
    <Svg w={w} height={height} label={spec.title}>
      {spec.panels.map((panel, p) => {
        const x0 = labelW + (narrow ? 0 : p * (panelW + gap))
        const y0 = narrow ? p * (panelH + 14) : 0
        const max = Math.max(...panel.values)
        const usable = panelW - 56
        return (
          <g key={panel.name}>
            <text x={narrow ? 0 : x0} y={y0 + 14} fill={AXIS} fontSize={11} letterSpacing={1.2}>
              {panel.name.toUpperCase()}
            </text>
            {panel.values.map((v, r) => {
              const bw = Math.max(2, (v / max) * usable)
              const cy = y0 + head + r * rowH + rowH / 2
              return (
                <g key={r}>
                  {(narrow || p === 0) && (
                    <text
                      x={0}
                      y={cy + 5}
                      fill={LABEL}
                      fontSize={narrow ? 13 : 14}
                      fontWeight={500}
                    >
                      {spec.rows[r].label}
                    </text>
                  )}
                  <rect
                    x={x0}
                    y={cy - 10}
                    width={usable}
                    height={20}
                    rx={5}
                    fill="rgba(255,255,255,0.03)"
                  />
                  <rect
                    x={x0}
                    y={cy - 10}
                    width={bw}
                    height={20}
                    rx={5}
                    fill={color(spec.rows[r].color, r)}
                    fillOpacity={0.85}
                  />
                  <text x={x0 + bw + 8} y={cy + 5} fill="#ffffff" fontSize={13} fontWeight={600}>
                    {v.toLocaleString('en-US')}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}
    </Svg>
  )
}

function Line({ spec, w }: { spec: LineChart; w: number }) {
  const narrow = w < 500
  const l = narrow ? 36 : 44
  const r = w - (narrow ? 52 : 168)
  const t = 34
  const b = narrow ? 270 : 320
  const height = b + 44
  const n = spec.x.count
  const x = (i: number) => l + (i / (n - 1)) * (r - l)
  const y = (v: number) => b - ((v - spec.y.min) / (spec.y.max - spec.y.min)) * (b - t)
  const unit = spec.unit || ''

  const ends = spec.series
    .map((s, i) => ({
      name: s.name,
      v: s.values[n - 1],
      c: color(s.color, i),
      y: y(s.values[n - 1]),
    }))
    .sort((a, c) => a.y - c.y)
  for (let i = 1; i < ends.length; i++) {
    if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15
  }

  return (
    <Svg w={w} height={height} label={spec.title}>
      {(spec.bands || []).map((band, i) => (
        <g key={band.label}>
          <rect
            x={x(band.from)}
            y={t - 22}
            width={x(band.to) - x(band.from)}
            height={b - t + 22}
            fill={color(band.color, i)}
            fillOpacity={i % 2 ? 0.05 : 0.08}
          />
          <rect
            x={x(band.from)}
            y={t - 22}
            width={x(band.to) - x(band.from)}
            height={2}
            fill={color(band.color, i)}
          />
          <text
            x={(x(band.from) + x(band.to)) / 2}
            y={t - 7}
            fill={color(band.color, i)}
            fontSize={narrow ? 11 : 12}
            fontWeight={600}
            textAnchor="middle"
          >
            {band.label}
          </text>
        </g>
      ))}
      {ticks(spec.y.min, spec.y.max, 5).map((v) => (
        <g key={v}>
          <line x1={l} x2={r} y1={y(v)} y2={y(v)} stroke={GRID} />
          <text x={l - 8} y={y(v) + 4} fill={AXIS} fontSize={11} textAnchor="end">
            {fmt(v, unit)}
          </text>
        </g>
      ))}
      {Array.from({ length: n }, (_, i) => i)
        .filter((i) => i % (narrow ? 6 : 2) === 0 || i === n - 1)
        .map((i) => (
          <text key={i} x={x(i)} y={b + 18} fill={AXIS} fontSize={11} textAnchor="middle">
            {i}
          </text>
        ))}
      {spec.x.label && (
        <text x={(l + r) / 2} y={b + 38} fill={LABEL} fontSize={12} textAnchor="middle">
          {spec.x.label}
        </text>
      )}
      {spec.series.map((s, i) => (
        <g key={s.name}>
          <polyline
            points={s.values.map((v, k) => `${x(k)},${y(v)}`).join(' ')}
            fill="none"
            stroke={color(s.color, i)}
            strokeWidth={narrow ? 2 : 2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={s.dashed ? '5 5' : undefined}
          />
          <circle cx={x(n - 1)} cy={y(s.values[n - 1])} r={4} fill={color(s.color, i)} />
        </g>
      ))}
      {ends.map((e) => (
        <text key={e.name} x={r + 10} y={e.y + 4} fill={e.c} fontSize={12} fontWeight={600}>
          {narrow ? fmt(e.v, unit) : e.name}
          {!narrow && <tspan fill="#ffffff" fontWeight={500}>{`  ${fmt(e.v, unit)}`}</tspan>}
        </text>
      ))}
    </Svg>
  )
}

function Stack({ spec, w }: { spec: StackChart; w: number }) {
  const narrow = w < 500
  const labelW = narrow ? 0 : 200
  const rowH = narrow ? 64 : 54
  const barH = narrow ? 30 : 34
  const right = w - 4
  const height = spec.rows.length * rowH + 4
  const unit = spec.unit || ''
  return (
    <Svg w={w} height={height} label={spec.title}>
      {spec.rows.map((row, r) => {
        const total = row.values.reduce((s, v) => s + v, 0) || 1
        const barY = narrow ? r * rowH + 22 : r * rowH + (rowH - barH) / 2 + 4
        let cursor = labelW
        return (
          <g key={row.label}>
            <text
              x={0}
              y={narrow ? r * rowH + 14 : barY + barH / 2 + 5}
              fill={LABEL}
              fontSize={narrow ? 12.5 : 14}
              fontWeight={500}
            >
              {row.label}
            </text>
            {row.values.map((v, i) => {
              const sw = (v / total) * (right - labelW)
              const x0 = cursor
              cursor += sw
              if (sw <= 0) return null
              const seg = spec.segments[i]
              return (
                <g key={i}>
                  <rect
                    x={x0}
                    y={barY}
                    width={Math.max(0, sw - 2)}
                    height={barH}
                    rx={4}
                    fill={color(seg.color, i)}
                  >
                    <title>{`${seg.name}: ${fmt(v, unit)}`}</title>
                  </rect>
                  {sw > (narrow ? 30 : 38) && (
                    <text
                      x={x0 + (sw - 2) / 2}
                      y={barY + barH / 2 + 4}
                      fill="#0b1020"
                      fontSize={narrow ? 11 : 12}
                      fontWeight={700}
                      textAnchor="middle"
                    >
                      {fmt(Math.round(v), unit)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
    </Svg>
  )
}

export default function UpdateChart({ spec }: { spec: ChartSpec }) {
  let legend: LegendItem[] = []
  let render: (w: number) => ReactNode
  switch (spec.type) {
    case 'dots':
      legend = [
        ...spec.series.map((s, i) => ({ name: s.name, color: color(s.color, i) })),
        ...(spec.marker ? [{ name: spec.marker.name, shape: 'tick' as const }] : []),
      ]
      render = (w) => <Dots spec={spec} w={w} />
      break
    case 'scatter':
      render = (w) => <Scatter spec={spec} w={w} />
      break
    case 'bars':
      render = (w) => <Bars spec={spec} w={w} />
      break
    case 'line':
      legend = spec.series.map((s, i) => ({
        name: s.name,
        color: color(s.color, i),
        shape: s.dashed ? ('dash' as const) : ('dot' as const),
      }))
      render = (w) => <Line spec={spec} w={w} />
      break
    case 'stack':
      legend = spec.segments.map((s, i) => ({
        name: s.name,
        color: color(s.color, i),
        shape: 'square' as const,
      }))
      render = (w) => <Stack spec={spec} w={w} />
      break
  }
  return (
    <Figure
      figure={spec.figure}
      title={spec.title}
      subtitle={spec.subtitle}
      source={spec.source}
      legend={legend}
    >
      <Responsive render={render} />
    </Figure>
  )
}
