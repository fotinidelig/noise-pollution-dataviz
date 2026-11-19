import { useEffect, useMemo, useRef, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { select } from 'd3-selection'
import { curveMonotoneY, line as d3Line } from 'd3-shape'
import 'd3-transition'
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
type Seg = { x1: number; y1: number; x2: number; y2: number; color: string }

const LDEN_KEYS = ['55-59', '60-64', '65-69', '70-74', '>75'] as const
const LNIGHT_KEYS = ['50-54', '55-59', '60-64', '65-69', '>70'] as const

/** Uniform stroke for every segment — abstract sidecar line. */
const STROKE_WIDTH = 2.4
const LEAVE_MS = 200
const ENTER_MS = 160

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

/**
 * Sample a people×dB path. Use monotone-Y so dB stays ordered
 * (low → bottom, high → top) — Catmull-Rom overshoots into a U when
 * people peak in mid bands.
 */
function sampleWavePath(
  anchors: { x: number; y: number; color: string }[],
  segmentsPerSpan = 18,
): Pt[] {
  if (anchors.length < 2) return []
  const line = d3Line<{ x: number; y: number }>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curveMonotoneY)
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

function samplesToSegs(samples: Pt[]): Seg[] {
  if (samples.length < 2) return []
  const segs: Seg[] = []
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i]
    const b = samples[i + 1]
    segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: a.color })
  }
  return segs
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
  const waveGRef = useRef<SVGGElement | null>(null)
  const [size, setSize] = useState({ w: 160, h: 200 })
  /** Keep sidecar mounted through leave fade so D3 can tween opacity out. */
  const [panelLive, setPanelLive] = useState(false)
  const lastSidecar = useRef(sidecar)

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
  }, [panelLive])

  const bandMeta = metric === 'Lden' ? LDEN_BANDS : LNIGHT_BANDS
  const bandKeys = metric === 'Lden' ? [...LDEN_KEYS] : [...LNIGHT_KEYS]
  const seriesKey = `${source}__${metric}`

  const active = useMemo(() => {
    const series = hoverSeries ?? pinnedSeries
    const id = hoveredId ?? pinnedId
    const order = new Map<string, number>(bandKeys.map((b, i) => [b, i]))

    const normalize = (
      raw: { band: string; label: string; color: string; people: number }[],
      id0: string,
      name: string,
      total: number,
    ) => {
      // Keep ascending dB order; drop zero / missing loud bands
      const points = raw
        .filter((p) => p.people > 0)
        .sort((a, b) => (order.get(a.band) ?? 0) - (order.get(b.band) ?? 0))
      if (!points.length) return null
      return {
        id: id0,
        name,
        total,
        points,
        localMax: Math.max(1, ...points.map((p) => p.people)),
      }
    }

    if (series && series.points.length) {
      return normalize(series.points, series.id, series.name, series.total)
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
    return normalize(points, city.id, city.agglomeration, tip.total)
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

  if (sidecar) lastSidecar.current = sidecar
  const show = Boolean(active && sidecar)
  useEffect(() => {
    if (show) setPanelLive(true)
  }, [show])

  const pad = { top: 10, right: 14, bottom: 10, left: 10 }
  const innerW = Math.max(40, size.w - pad.left - pad.right)
  const innerH = Math.max(40, size.h - pad.top - pad.bottom)

  const anchors = useMemo(() => {
    if (!active?.points.length) return []
    const n = active.points.length
    const y = scaleLinear()
      .domain([0, Math.max(1, n - 1)])
      .range([innerH, 0])
    const x = scaleLinear()
      .domain([0, active.localMax])
      .nice()
      .range([0, innerW])
    return active.points.map((p, i) => ({
      x: x(p.people),
      y: y(i),
      color: p.color,
    }))
  }, [active, innerW, innerH])

  const samples = useMemo(() => sampleWavePath(anchors, 22), [anchors])
  const segs = useMemo(() => samplesToSegs(samples), [samples])

  // Efficient D3 join — update stroke/geometry in place; fade out on leave (no remount flash).
  useEffect(() => {
    const node = waveGRef.current
    if (!node) return
    const g = select(node)
    const data = show ? segs : []

    const sel = g.selectAll<SVGLineElement, Seg>('line.wave-seg').data(data, (_, i) => String(i))

    sel
      .exit()
      .transition()
      .duration(LEAVE_MS)
      .attr('opacity', 0)
      .remove()
      .on('end', () => {
        if (!show && g.selectAll('line.wave-seg').empty()) setPanelLive(false)
      })

    const enter = sel
      .enter()
      .append('line')
      .attr('class', 'wave-seg')
      .attr('stroke-width', STROKE_WIDTH)
      .attr('opacity', 0)
      .attr('x1', (d) => d.x1)
      .attr('y1', (d) => d.y1)
      .attr('x2', (d) => d.x2)
      .attr('y2', (d) => d.y2)
      .attr('stroke', (d) => d.color)

    enter.transition().duration(ENTER_MS).attr('opacity', 1)

    sel
      .interrupt()
      .attr('x1', (d) => d.x1)
      .attr('y1', (d) => d.y1)
      .attr('x2', (d) => d.x2)
      .attr('y2', (d) => d.y2)
      .attr('stroke', (d) => d.color)
      .transition()
      .duration(ENTER_MS)
      .attr('opacity', 1)

    if (!show && data.length === 0 && g.selectAll('line.wave-seg').empty()) {
      setPanelLive(false)
    }
  }, [segs, show])

  const dock = sidecar ?? lastSidecar.current
  if (!panelLive || !dock) return null

  return (
    <div
      className={`wave-panel wave-panel--sidecar${pinned ? ' is-pinned' : ''}`}
      aria-hidden="true"
      style={{
        left: dock.left,
        top: dock.top,
        height: dock.height,
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
            <g className="wave-active" ref={waveGRef} />
          </g>
        </svg>
      </div>
    </div>
  )
}
