import { useEffect, useMemo, useRef, useState } from 'react'
import { scaleLinear, scalePoint } from 'd3-scale'
import { curveCatmullRom, line as d3Line } from 'd3-shape'
import {
  LDEN_BANDS,
  LNIGHT_BANDS,
  type NoiseMetric,
  type NoiseSource,
} from '../lib/noiseStyle'
import './CityWaveChart.css'

export type ChartBand = {
  band: string
  label: string
  color: string
  people: number
  rings: number
}

export type ChartSeries = {
  mean_db: number | null
  total: number
  bands: ChartBand[]
}

export type ChartCity = {
  id: string
  agglomeration: string
  country: string
  inhabitants: number
  lon?: number
  lat?: number
  series: Record<string, ChartSeries>
}

export type HoverSeries = {
  id: string
  name: string
  total: number
  points: { band: string; label: string; color: string; people: number }[]
}

type Props = {
  cities: ChartCity[]
  source: NoiseSource
  metric: NoiseMetric
  /** Live hover from the map (temporary). */
  hoveredId: string | null
  hoverSeries?: HoverSeries | null
  /** Click-pinned city — stays until cleared. */
  pinnedId?: string | null
  pinnedSeries?: HoverSeries | null
  pinned?: boolean
}

type Pt = { x: number; y: number; color: string; t: number }

const LDEN_KEYS = ['55-59', '60-64', '65-69', '70-74', '>75'] as const
const LNIGHT_KEYS = ['50-54', '55-59', '60-64', '65-69', '>70'] as const

function formatPeople(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [
      Number.parseInt(h.slice(0, 2), 16),
      Number.parseInt(h.slice(2, 4), 16),
      Number.parseInt(h.slice(4, 6), 16),
    ]
  }
  const ca = parse(a)
  const cb = parse(b)
  const mix = ca.map((v, i) => Math.round(v + (cb[i] - v) * t))
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`
}

function sampleCatmullRom(
  anchors: { x: number; y: number; color: string }[],
  segmentsPerSpan = 18,
): Pt[] {
  if (anchors.length < 2) return []
  const line = d3Line<{ x: number; y: number }>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curveCatmullRom.alpha(0.9))
  const d = line(anchors)
  if (!d || typeof document === 'undefined') {
    const out: Pt[] = []
    for (let i = 0; i < anchors.length; i++) {
      out.push({ ...anchors[i], t: i / (anchors.length - 1) })
    }
    return out
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  const len = path.getTotalLength()
  const n = Math.max(2, (anchors.length - 1) * segmentsPerSpan)
  const samples: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const p = path.getPointAtLength(u * len)
    const f = u * (anchors.length - 1)
    const i0 = Math.floor(f)
    const i1 = Math.min(anchors.length - 1, i0 + 1)
    const local = f - i0
    samples.push({
      x: p.x,
      y: p.y,
      t: u,
      color: lerpColor(anchors[i0].color, anchors[i1].color, local),
    })
  }
  return samples
}

export function CityWaveChart({
  cities,
  source,
  metric,
  hoveredId,
  hoverSeries = null,
  pinnedId = null,
  pinnedSeries = null,
  pinned = false,
}: Props) {
  const plotRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 220, h: 640 })
  const [bandTip, setBandTip] = useState<{
    label: string
    people: number
    color: string
    x: number
    y: number
  } | null>(null)

  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize({
        w: Math.max(160, Math.floor(cr.width)),
        h: Math.max(200, Math.floor(cr.height)),
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const bandMeta = metric === 'Lden' ? LDEN_BANDS : LNIGHT_BANDS
  const bandKeys = metric === 'Lden' ? [...LDEN_KEYS] : [...LNIGHT_KEYS]
  const seriesKey = `${source}__${metric}`

  const active = useMemo(() => {
    const series = hoverSeries ?? pinnedSeries
    const id = hoveredId ?? pinnedId
    if (series && series.points.length) {
      return {
        ...series,
        localMax: Math.max(1, ...series.points.map((p) => p.people)),
      }
    }
    if (!id) return null
    const city = cities.find((c) => c.id === id)
    if (!city) return null
    const tip = city.series[seriesKey]
    if (!tip || !(tip.total > 0)) return null
    const byBand = new Map(tip.bands.map((b) => [b.band, b]))
    const points = bandKeys.map((b, i) => {
      const hit = byBand.get(b)
      return {
        band: b,
        label: bandMeta[i]?.label ?? b,
        color: hit?.color ?? bandMeta[i]?.color ?? '#88aaaa',
        people: hit?.people ?? 0,
      }
    })
    return {
      id: city.id,
      name: city.agglomeration,
      total: tip.total,
      points,
      localMax: Math.max(1, ...points.map((p) => p.people)),
    }
  }, [
    hoverSeries,
    pinnedSeries,
    hoveredId,
    pinnedId,
    cities,
    seriesKey,
    bandKeys,
    bandMeta,
  ])

  useEffect(() => {
    setBandTip(null)
  }, [active?.id, source, metric])

  const pad = { top: 16, right: 36, bottom: 28, left: 52 }
  const innerW = Math.max(40, size.w - pad.left - pad.right)
  const innerH = Math.max(80, size.h - pad.top - pad.bottom)

  const y = scalePoint<string>()
    .domain(bandKeys)
    .range([0, innerH])
    .padding(0.4)

  const x = scaleLinear()
    .domain([0, active?.localMax ?? 1])
    .nice()
    .range([0, innerW])

  const anchors = useMemo(() => {
    if (!active) return []
    return active.points.map((p) => ({
      x: x(p.people),
      y: y(p.band) ?? 0,
      color: p.color,
      people: p.people,
      band: p.band,
      label: p.label,
    }))
  }, [active, x, y])

  const samples = useMemo(() => sampleCatmullRom(anchors, 22), [anchors])

  const glowPath = useMemo(() => {
    if (anchors.length < 2) return null
    return d3Line<(typeof anchors)[number]>()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(curveCatmullRom.alpha(0.9))(anchors)
  }, [anchors])

  const maxAnchor = useMemo(() => {
    if (!anchors.length) return null
    return anchors.reduce((best, p) => (p.people > best.people ? p : best), anchors[0])
  }, [anchors])

  const xTicks = x.ticks(3).filter((t) => t < (active?.localMax ?? 0) * 0.92)

  if (!active) return null

  return (
    <div
      className={`wave-panel has-series${pinned ? ' is-pinned' : ''}`}
      aria-label="People by dB band"
    >
      <div className="wave-panel__head">
        <span className="wave-panel__meta">
          {active.name}
          {pinned ? <span className="wave-pin-badge">pinned</span> : null}
        </span>
      </div>
      <div className="wave-panel__plot" ref={plotRef}>
        <svg
          className="wave-svg"
          width={size.w}
          height={size.h}
          role="img"
          aria-label="Sound-wave profile for selected agglomeration"
        >
          <g transform={`translate(${pad.left},${pad.top})`}>
            <line className="wave-axis" x1={0} x2={0} y1={0} y2={innerH} />
            <line
              className="wave-axis"
              x1={0}
              x2={innerW}
              y1={innerH}
              y2={innerH}
            />

            {bandKeys.map((b, i) => {
              const py = y(b)
              if (py == null) return null
              return (
                <g key={b}>
                  <line
                    className="wave-band-grid"
                    x1={0}
                    x2={innerW}
                    y1={py}
                    y2={py}
                  />
                  <text
                    className="wave-band-label"
                    x={-8}
                    y={py}
                    textAnchor="end"
                    dominantBaseline="middle"
                  >
                    {bandMeta[i]?.label.replace(' dB', '') ?? b}
                  </text>
                </g>
              )
            })}

            {xTicks.map((t) => (
              <g key={t}>
                <line
                  className="wave-band-grid"
                  x1={x(t)}
                  x2={x(t)}
                  y1={0}
                  y2={innerH}
                />
                <text
                  className="wave-x-label"
                  x={x(t)}
                  y={innerH + 16}
                  textAnchor="middle"
                >
                  {formatPeople(t)}
                </text>
              </g>
            ))}

            {samples.length > 1 ? (
              <g className="wave-active">
                {glowPath ? <path className="wave-glow" d={glowPath} /> : null}
                {samples.slice(0, -1).map((a, i) => {
                  const b = samples[i + 1]
                  return (
                    <line
                      key={`s-${i}`}
                      className="wave-seg"
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={a.color}
                    />
                  )
                })}

                {maxAnchor ? (
                  <g className="wave-max">
                    <line
                      className="wave-max-guide"
                      x1={maxAnchor.x}
                      y1={maxAnchor.y}
                      x2={innerW}
                      y2={maxAnchor.y}
                    />
                    <text
                      className="wave-max-label"
                      x={innerW + 4}
                      y={maxAnchor.y}
                      dominantBaseline="middle"
                    >
                      {formatPeople(maxAnchor.people)}
                    </text>
                  </g>
                ) : null}

                {anchors.map((p) => (
                  <g key={p.band}>
                    <circle
                      className="wave-dot-hit"
                      cx={p.x}
                      cy={p.y}
                      r={10}
                      onMouseEnter={() =>
                        setBandTip({
                          label: p.label,
                          people: p.people,
                          color: p.color,
                          x: pad.left + p.x,
                          y: pad.top + p.y,
                        })
                      }
                      onMouseLeave={() => setBandTip(null)}
                    />
                    <circle
                      className="wave-dot"
                      cx={p.x}
                      cy={p.y}
                      r={3.4}
                      fill={p.color}
                      pointerEvents="none"
                    />
                  </g>
                ))}
              </g>
            ) : null}
          </g>
        </svg>

        {bandTip ? (
          <div
            className="wave-band-tip"
            style={{
              left: Math.min(bandTip.x + 12, size.w - 120),
              top: Math.max(8, bandTip.y - 28),
            }}
          >
            <span
              className="wave-band-tip__swatch"
              style={{ background: bandTip.color }}
            />
            <span>{bandTip.label}</span>
            <strong>{formatPeople(bandTip.people)}</strong>
          </div>
        ) : null}
      </div>
      <div className="wave-hover-label">
        {active.name}
        <span className="wave-hover-total">
          {formatPeople(active.total)} people
        </span>
      </div>
    </div>
  )
}
