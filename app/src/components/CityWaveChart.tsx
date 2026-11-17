import { useEffect, useMemo, useRef, useState } from 'react'
import { max } from 'd3-array'
import { scaleLinear, scalePoint } from 'd3-scale'
import { area as d3Area, curveBasis, line as d3Line } from 'd3-shape'
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
  series: Record<string, ChartSeries>
}

type Props = {
  cities: ChartCity[]
  source: NoiseSource
  metric: NoiseMetric
  hoveredId: string | null
  onHoverCity: (id: string | null) => void
}

type Row = {
  id: string
  name: string
  total: number
  values: number[]
  colors: string[]
}

const LDEN_KEYS = ['55-59', '60-64', '65-69', '70-74', '>75'] as const
const LNIGHT_KEYS = ['50-54', '55-59', '60-64', '65-69', '>70'] as const

export function CityWaveChart({
  cities,
  source,
  metric,
  hoveredId,
  onHoverCity,
}: Props) {
  const plotRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 220, h: 640 })

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

  const rows: Row[] = useMemo(() => {
    const key = `${source}__${metric}`
    const out: Row[] = []
    for (const c of cities) {
      const tip = c.series[key]
      if (!tip || !(tip.total > 0)) continue
      const byBand = new Map(tip.bands.map((b) => [b.band, b]))
      out.push({
        id: c.id,
        name: c.agglomeration,
        total: tip.total,
        values: bandKeys.map((b) => byBand.get(b)?.people ?? 0),
        colors: bandKeys.map(
          (b, i) => byBand.get(b)?.color ?? bandMeta[i]?.color ?? '#88a',
        ),
      })
    }
    out.sort((a, b) => b.total - a.total)
    return out
  }, [cities, source, metric, bandKeys, bandMeta])

  const pad = { top: 8, right: 8, bottom: 20, left: 8 }
  const innerW = size.w - pad.left - pad.right
  const innerH = Math.max(80, size.h - pad.top - pad.bottom)

  const x = scalePoint<string>()
    .domain(bandKeys)
    .range([0, Math.max(innerW, 1)])
    .padding(0.15)

  const y = scalePoint<string>()
    .domain(rows.map((r) => r.id))
    .range([0, Math.max(innerH, 1)])
    .padding(0.02)

  const peopleMax = max(rows, (r) => max(r.values) ?? 0) ?? 1
  const rowGap = rows.length > 1 ? innerH / Math.max(rows.length - 1, 1) : innerH
  const amp = scaleLinear()
    .domain([0, peopleMax])
    .range([0, Math.min(18, Math.max(3.5, rowGap * 0.85))])

  const lineGen = d3Line<[number, number]>()
    .x((d) => d[0])
    .y((d) => d[1])
    .curve(curveBasis)

  return (
    <div className="wave-panel" aria-label="People by dB band">
      <div className="wave-panel__head">
        <span className="wave-panel__title">people × dB</span>
        <span className="wave-panel__meta">{rows.length} cities</span>
      </div>
      <div className="wave-panel__plot" ref={plotRef}>
      <svg
        className="wave-svg"
        width={size.w}
        height={size.h}
        role="img"
        aria-label="Sound-wave profiles by agglomeration"
      >
        <g transform={`translate(${pad.left},${pad.top})`}>
          {bandKeys.map((b, i) => {
            const px = x(b)
            if (px == null) return null
            return (
              <g key={b}>
                <line
                  className="wave-band-grid"
                  x1={px}
                  x2={px}
                  y1={0}
                  y2={innerH}
                />
                <text
                  className="wave-band-label"
                  x={px}
                  y={innerH + 14}
                  textAnchor="middle"
                >
                  {bandMeta[i]?.label.replace(' dB', '') ?? b}
                </text>
              </g>
            )
          })}

          {rows.map((row) => {
            const baseline = y(row.id) ?? 0
            const pts: [number, number][] = row.values.map((v, i) => {
              const bx = x(bandKeys[i]) ?? 0
              return [bx, baseline - amp(v)]
            })
            const areaPath = d3Area<[number, number]>()
              .x((d) => d[0])
              .y0(baseline)
              .y1((d) => d[1])
              .curve(curveBasis)(pts)
            const path = lineGen(pts)
            const active = hoveredId === row.id
            const dimmed = hoveredId != null && !active
            return (
              <g
                key={row.id}
                className={
                  active
                    ? 'wave-row is-active'
                    : dimmed
                      ? 'wave-row is-dim'
                      : 'wave-row'
                }
                onMouseEnter={() => onHoverCity(row.id)}
                onMouseLeave={() => onHoverCity(null)}
              >
                <rect
                  className="wave-hit"
                  x={-4}
                  y={baseline - Math.max(amp.range()[1], 4)}
                  width={innerW + 8}
                  height={Math.max(amp.range()[1] * 1.4, 6)}
                />
                {areaPath ? <path className="wave-area" d={areaPath} /> : null}
                {path ? <path className="wave-line" d={path} /> : null}
                {pts.map((p, i) =>
                  row.values[i] > 0 ? (
                    <circle
                      key={bandKeys[i]}
                      className="wave-dot"
                      cx={p[0]}
                      cy={p[1]}
                      r={active ? 2.4 : 1.2}
                      fill={row.colors[i]}
                    />
                  ) : null,
                )}
              </g>
            )
          })}
        </g>
      </svg>
      </div>
      {hoveredId ? (
        <div className="wave-hover-label">
          {rows.find((r) => r.id === hoveredId)?.name}
        </div>
      ) : null}
    </div>
  )
}
