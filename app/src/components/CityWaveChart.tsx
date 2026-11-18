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
  /** Docked to the right of the map tooltip (mock sidecar). */
  sidecar?: { left: number; top: number; height: number } | null
}

type Pt = { x: number; y: number; color: string; t: number }

const LDEN_KEYS = ['55-59', '60-64', '65-69', '70-74', '>75'] as const
const LNIGHT_KEYS = ['50-54', '55-59', '60-64', '65-69', '>70'] as const

/** Uniform stroke for every segment — abstract sidecar line. */
const STROKE_WIDTH = 2.4

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
  sidecar = null,
}: Props) {
  const plotRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 160, h: 200 })

  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize({
        w: Math.max(80, Math.floor(cr.width)),
        h: Math.max(80, Math.floor(cr.height)),
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

  const pad = { top: 10, right: 14, bottom: 10, left: 10 }
  const innerW = Math.max(40, size.w - pad.left - pad.right)
  const innerH = Math.max(40, size.h - pad.top - pad.bottom)

  const y = scalePoint<string>()
    .domain(bandKeys)
    .range([0, innerH])
    .padding(0.35)

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
    }))
  }, [active, x, y])

  const samples = useMemo(() => sampleCatmullRom(anchors, 22), [anchors])

  if (!active || !sidecar) return null

  return (
    <div
      className={`wave-panel wave-panel--sidecar${pinned ? ' is-pinned' : ''}`}
      aria-hidden="true"
      style={{
        left: sidecar.left,
        top: sidecar.top,
        height: sidecar.height,
      }}
    >
      <div className="wave-panel__plot" ref={plotRef}>
        <svg
          className="wave-svg"
          width={size.w}
          height={size.h}
          role="img"
          aria-label="People by dB band"
        >
          <g transform={`translate(${pad.left},${pad.top})`}>
            {samples.length > 1 ? (
              <g className="wave-active">
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
                      strokeWidth={STROKE_WIDTH}
                    />
                  )
                })}
              </g>
            ) : null}
          </g>
        </svg>
      </div>
    </div>
  )
}
