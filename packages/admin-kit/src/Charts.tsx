import { type PointerEvent, type ReactNode, useId, useRef, useState } from 'react'
import { useLocale } from './locale.tsx'

/**
 * Small SVG charts, no library: smooth (monotone) curves with a gradient under the line and rounded joins and caps, rounded
 * bars, a donut with rounded ends. Colours are tokens, so light and dark follow by themselves. Every chart has a real table
 * of its numbers behind a smooth-opening « view the numbers » fold, with full month names and years.
 */
export type Tone = 'primary' | 'gold' | 'info' | 'clay' | 'success'
export type Series = { key: string; label: string; values: number[]; tone: Tone }

const TONE: Record<Tone, string> = {
  primary: 'var(--primary)',
  gold: 'var(--gold)',
  info: 'var(--info)',
  clay: 'var(--clay)',
  success: 'var(--success)',
}

/**
 * Our tooltip for charts (instead of the browser's grey title): a dark bubble that follows the pointer over a point, bar or
 * slice. Keyboard and screen-reader users read the same numbers in the table under every chart.
 */
function useChartTip() {
  const wrap = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const show = (text: string) => (e: PointerEvent) => {
    const box = wrap.current?.getBoundingClientRect()
    if (box) setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text })
  }
  const hide = () => setTip(null)
  const bubble = tip && (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="presentation">
      {tip.text}
    </div>
  )
  return { wrap, show, hide, bubble }
}

/** « 2026-01 » → « janvier 2026 » (full, for tables) or « janv. » (short, for the axis). */
export function monthName(ym: string, locale: string, style: 'long' | 'short' = 'long') {
  // « 2026-01-15 » (a day, for the visits chart) → « 15 oct. » / « 15 octobre 2026 ».
  if (ym.length === 10) {
    const day = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: style,
      ...(style === 'long' ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    }).format(new Date(`${ym}T00:00:00Z`))
    return day
  }
  const d = new Date(`${ym}-01T00:00:00Z`)
  const f = new Intl.DateTimeFormat(locale, {
    month: style,
    ...(style === 'long' ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(d)
  return f.charAt(0).toUpperCase() + f.slice(1)
}

/** A smooth curve through the points that never overshoots (monotone cubic, as d3's curveMonotoneX). */
export function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0]?.[0]} ${pts[0]?.[1]}`
  const n = pts.length
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i] as [number, number]
    const b = pts[i + 1] as [number, number]
    dx[i] = b[0] - a[0]
    slope[i] = (b[1] - a[1]) / (dx[i] || 1)
  }
  const tan: number[] = [slope[0] ?? 0]
  for (let i = 1; i < n - 1; i++) {
    const s0 = slope[i - 1] ?? 0
    const s1 = slope[i] ?? 0
    tan[i] = s0 * s1 <= 0 ? 0 : (s0 + s1) / 2
  }
  tan[n - 1] = slope[n - 2] ?? 0
  for (let i = 0; i < n - 1; i++) {
    const s = slope[i] ?? 0
    if (s === 0) {
      tan[i] = 0
      tan[i + 1] = 0
      continue
    }
    const a = (tan[i] ?? 0) / s
    const b = (tan[i + 1] ?? 0) / s
    const h = Math.hypot(a, b)
    if (h > 3) {
      tan[i] = ((3 * a) / h) * s
      tan[i + 1] = ((3 * b) / h) * s
    }
  }
  let d = `M${(pts[0] as [number, number])[0].toFixed(1)} ${(pts[0] as [number, number])[1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i] as [number, number]
    const b = pts[i + 1] as [number, number]
    const w = (dx[i] ?? 0) / 3
    d += `C${(a[0] + w).toFixed(1)} ${(a[1] + w * (tan[i] ?? 0)).toFixed(1)} ${(b[0] - w).toFixed(1)} ${(b[1] - w * (tan[i + 1] ?? 0)).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`
  }
  return d
}

const W = 480
const H = 170
const PAD = { l: 8, r: 8, t: 12, b: 24 }

function scale(series: Series[]) {
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  // A round ceiling so the grid reads well.
  const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 50 ? 10 : 50
  return Math.max(step, Math.ceil(max / step) * step)
}

export function AreaChart({
  months,
  series,
  label,
  wide,
}: {
  months: string[]
  series: Series[]
  label: string
  /** A chart that spans the whole width of a screen: drawn wider so it stays low instead of tall. */
  wide?: boolean
}) {
  const W = wide ? 960 : 480
  const { locale } = useLocale()
  const uid = useId().replace(/:/g, '')
  const tip = useChartTip()
  const [at, setAt] = useState<number | null>(null)
  const top = scale(series)
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, months.length - 1)
  const y = (n: number) => H - PAD.b - (n / top) * (H - PAD.b - PAD.t)
  // One popover per month listing EVERY series, so a line hidden behind another is still read.
  const textFor = (i: number) =>
    [
      monthName(months[i] ?? '', locale),
      ...series.map((s) => `${s.label}: ${s.values[i] ?? 0}`),
    ].join('\n')
  const slot = (W - PAD.l - PAD.r) / Math.max(1, months.length - 1)
  return (
    <div className="chart-wrap" ref={tip.wrap}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={TONE[s.tone]} stopOpacity="0.38" />
              <stop offset="100%" stopColor={TONE[s.tone]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            className="chart-grid"
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(top * f)}
            y2={y(top * f)}
          />
        ))}
        <text className="chart-y" x={W - PAD.r} y={y(top) - 3} textAnchor="end">
          {top}
        </text>
        {at !== null && (
          <line className="chart-guide" x1={x(at)} x2={x(at)} y1={PAD.t} y2={H - PAD.b} />
        )}
        {series.map((s) => {
          const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number])
          const line = smoothPath(pts)
          return (
            <g key={s.key}>
              <path
                d={`${line}L${x(months.length - 1)} ${H - PAD.b}L${x(0)} ${H - PAD.b}Z`}
                fill={`url(#${uid}-${s.key})`}
                className="chart-area"
              />
              <path className="chart-line" d={line} stroke={TONE[s.tone]} pathLength={1} />
              {/* Every point is drawn, so crests and troughs can be seen and aimed at. */}
              {pts.map((p, i) => (
                <circle
                  key={months[i]}
                  className="chart-point"
                  cx={p[0]}
                  cy={p[1]}
                  r={at === i ? 5 : 3}
                  fill={at === i ? TONE[s.tone] : 'var(--surface)'}
                  stroke={TONE[s.tone]}
                  strokeWidth="2"
                />
              ))}
            </g>
          )
        })}
        {months.map((m, i) =>
          // Twelve months: every other label. A month of days: every fifth.
          (months.length > 14
            ? i % 5 === 0 && i < months.length - 2
            : i % 2 === (months.length % 2 === 0 ? 1 : 0)) || i === months.length - 1 ? (
            <text key={m} className="chart-x" x={x(i)} y={H - 6} textAnchor="middle">
              {monthName(m, locale, 'short').replace('.', '')}
            </text>
          ) : null,
        )}
        {/* A column of the chart per month: hovering it (or tapping on a phone) shows all the series at that month. */}
        {months.map((m, i) => (
          <rect
            key={`hit-${m}`}
            className="chart-hit"
            x={x(i) - slot / 2}
            y={0}
            width={slot}
            height={H}
            onPointerEnter={(e) => {
              setAt(i)
              tip.show(textFor(i))(e)
            }}
            onPointerMove={tip.show(textFor(i))}
            onPointerLeave={() => {
              setAt(null)
              tip.hide()
            }}
          />
        ))}
      </svg>
      {tip.bubble}
    </div>
  )
}

export function BarChart({
  months,
  series,
  label,
}: {
  months: string[]
  series: Series
  label: string
}) {
  const { locale } = useLocale()
  const uid = useId().replace(/:/g, '')
  const tip = useChartTip()
  const top = scale([series])
  const slot = (W - PAD.l - PAD.r) / months.length
  const bw = Math.min(26, slot * 0.62)
  const y = (n: number) => H - PAD.b - (n / top) * (H - PAD.b - PAD.t)
  return (
    <div className="chart-wrap" ref={tip.wrap}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <defs>
          <linearGradient id={`${uid}-bar`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={TONE[series.tone]} stopOpacity="0.95" />
            <stop offset="100%" stopColor={TONE[series.tone]} stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            className="chart-grid"
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(top * f)}
            y2={y(top * f)}
          />
        ))}
        <text className="chart-y" x={W - PAD.r} y={y(top) - 3} textAnchor="end">
          {top}
        </text>
        {series.values.map((v, i) => {
          const h = Math.max(v > 0 ? 4 : 0, H - PAD.b - y(v))
          return (
            <rect
              key={months[i]}
              x={PAD.l + slot * i + (slot - bw) / 2}
              y={H - PAD.b - h}
              width={bw}
              height={h}
              rx={Math.min(8, bw / 2)}
              fill={`url(#${uid}-bar)`}
              className="chart-bar"
              style={{ animationDelay: `${i * 45}ms` }}
            />
          )
        })}
        {series.values.map((v, i) => (
          <rect
            key={`hit-${months[i]}`}
            className="chart-hit"
            x={PAD.l + slot * i}
            y={PAD.t}
            width={slot}
            height={H - PAD.b - PAD.t}
            onPointerEnter={tip.show(
              `${monthName(months[i] ?? '', locale)} — ${series.label}: ${v}`,
            )}
            onPointerMove={tip.show(
              `${monthName(months[i] ?? '', locale)} — ${series.label}: ${v}`,
            )}
            onPointerLeave={tip.hide}
          />
        ))}
        {months.map((m, i) =>
          i % 2 === (months.length % 2 === 0 ? 1 : 0) || i === months.length - 1 ? (
            <text
              key={m}
              className="chart-x"
              x={PAD.l + slot * i + slot / 2}
              y={H - 6}
              textAnchor="middle"
            >
              {monthName(m, locale, 'short').replace('.', '')}
            </text>
          ) : null,
        )}
      </svg>
      {tip.bubble}
    </div>
  )
}

export function Donut({
  parts,
  label,
  total,
}: {
  parts: { key: string; label: string; n: number; tone: Tone }[]
  label: string
  total: string
}) {
  const tip = useChartTip()
  const sum = parts.reduce((a, p) => a + p.n, 0) || 1
  const r = 52
  const c = 2 * Math.PI * r
  const gap = parts.length > 1 ? 6 : 0
  let acc = 0
  return (
    <div className="donut chart-wrap" ref={tip.wrap}>
      <svg viewBox="0 0 140 140" role="img" aria-label={label}>
        <circle className="donut-track" cx="70" cy="70" r={r} />
        {parts.map((p) => {
          const len = Math.max(0, (p.n / sum) * c - gap)
          const el = (
            <circle
              key={p.key}
              className="donut-arc"
              cx="70"
              cy="70"
              r={r}
              stroke={TONE[p.tone]}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc}
              onPointerEnter={tip.show(`${p.label}: ${p.n}`)}
              onPointerMove={tip.show(`${p.label}: ${p.n}`)}
              onPointerLeave={tip.hide}
            />
          )
          acc += (p.n / sum) * c
          return el
        })}
        <text x="70" y="68" textAnchor="middle" className="donut-n">
          {parts.reduce((a, p) => a + p.n, 0)}
        </text>
        <text x="70" y="86" textAnchor="middle" className="donut-l">
          {total}
        </text>
      </svg>
      <ul className="donut-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span
              className="donut-swatch"
              style={{ background: TONE[p.tone] }}
              aria-hidden="true"
            />
            <span>{p.label}</span>
            <strong className="tabular-nums">{p.n}</strong>
          </li>
        ))}
      </ul>
      {tip.bubble}
    </div>
  )
}

/** A « view the numbers » fold that opens and closes smoothly (CSS, no script). */
export function Fold({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="fold">
      <summary>{summary}</summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}

/** The numbers behind a chart, with each month written out (« janvier 2026 »). */
export function ChartTable({
  months,
  series,
  monthHeader,
}: {
  months: string[]
  series: Series[]
  monthHeader: string
}) {
  const { locale } = useLocale()
  return (
    <div className="chart-table-wrap">
      <table className="chart-table">
        <thead>
          <tr>
            <th scope="col">{monthHeader}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={m}>
              <th scope="row">{monthName(m, locale)}</th>
              {series.map((s) => (
                <td key={s.key}>{s.values[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A chart card: title, legend, the chart, and a fold with its numbers. */
export function ChartCard({
  title,
  legend,
  children,
  table,
  summary,
}: {
  title: string
  legend?: Series[]
  children: ReactNode
  table?: { months: string[]; series: Series[]; monthHeader: string }
  summary?: string
}) {
  return (
    <div className="stat-card chart-card">
      <h3 className="text-lg">{title}</h3>
      {legend && legend.length > 1 && (
        <ul className="chart-legend">
          {legend.map((s) => (
            <li key={s.key}>
              <span
                className="donut-swatch"
                style={{ background: TONE[s.tone] }}
                aria-hidden="true"
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {children}
      {table && (
        <Fold summary={summary ?? ''}>
          <ChartTable {...table} />
        </Fold>
      )}
    </div>
  )
}
