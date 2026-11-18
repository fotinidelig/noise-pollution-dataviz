import { useEffect, useMemo, useRef, useState } from 'react'
import { scaleLinear, scalePoint } from 'd3-scale'
import { area as d3Area, curveCatmullRom, stack, stackOffsetSilhouette } from 'd3-shape'
import type { NoiseSource } from '../lib/noiseStyle'
import './ThemeRiverChart.css'

export type StreamCity = {
  id: string
  agglomeration: string
  country: string
  ha: number
  hsd: number
  highest_band_score: number
}

export type CountryTick = {
  country: string
  i0: number
  i1: number
  mid: number
  score: number
}

export type StreamSourcePayload = {
  cities: StreamCity[]
  countryTicks: CountryTick[]
  n: number
}

export type StreamData = {
  streams: string[]
  streamLabels: Record<string, string>
  bySource: Partial<Record<NoiseSource, StreamSourcePayload>>
}

type Props = {
  data: StreamData | null
  source: NoiseSource
  /** Live hover / pin from map or this chart */
  focusId: string | null
  onHoverCity: (id: string | null) => void
  /** Click hovered agglomeration → map fly/zoom (Explore). */
  onSelectCity?: (id: string) => void
}

const STREAM_KEYS = ['ha', 'hsd'] as const
type StreamKey = (typeof STREAM_KEYS)[number]

const STREAM_COLORS: Record<StreamKey, { fill: string; stroke: string }> = {
  ha: { fill: 'rgba(245, 0, 171, 0.55)', stroke: '#F500AB' },
  hsd: { fill: 'rgba(0, 184, 204, 0.5)', stroke: '#00B8CC' },
}

function formatPeople(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

type StackRow = { i: number; ha: number; hsd: number }

export function ThemeRiverChart({
  data,
  source,
  focusId,
  onHoverCity,
  onSelectCity,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const lastNotifiedId = useRef<string | null>(null)
  const [size, setSize] = useState({ w: 800, h: 168 })
  const [localHover, setLocalHover] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const payload = data?.bySource?.[source] ?? null

  useEffect(() => {
    const el = wrapRef.current
    if (!el || collapsed) return
    const apply = (width: number, height: number) => {
      setSize({
        w: Math.max(320, width),
        h: Math.max(120, height),
      })
    }
    const rect = el.getBoundingClientRect()
    apply(rect.width, rect.height)
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r || r.height < 80) return
      apply(r.width, r.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [collapsed])

  const layout = useMemo(() => {
    if (!payload || payload.cities.length < 2) return null
    const margin = { top: 18, right: 16, bottom: 28, left: 16 }
    const innerW = size.w - margin.left - margin.right
    const innerH = size.h - margin.top - margin.bottom
    const cities = payload.cities
    const ids = cities.map((c) => c.id)

    const x = scalePoint<string>().domain(ids).range([0, innerW]).padding(0.02)
    const rows: StackRow[] = cities.map((c, i) => ({
      i,
      ha: c.ha,
      hsd: c.hsd,
    }))

    const series = stack<StackRow>()
      .keys([...STREAM_KEYS])
      .offset(stackOffsetSilhouette)(rows)

    let yMin = Infinity
    let yMax = -Infinity
    for (const s of series) {
      for (const d of s) {
        yMin = Math.min(yMin, d[0])
        yMax = Math.max(yMax, d[1])
      }
    }
    const pad = (yMax - yMin) * 0.08 || 1
    const y = scaleLinear()
      .domain([yMin - pad, yMax + pad])
      .range([innerH, 0])

    const area = d3Area<(typeof series)[0][number]>()
      .x((d) => x(cities[d.data.i].id) ?? 0)
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(curveCatmullRom.alpha(0.65))

    const paths = series.map((s) => ({
      key: s.key as StreamKey,
      d: area(s) ?? '',
    }))

    const midY = y(0)
    const ticks = payload.countryTicks.map((t) => {
      const id0 = cities[t.i0]?.id
      const id1 = cities[t.i1]?.id
      const x0 = id0 != null ? (x(id0) ?? 0) : 0
      const x1 = id1 != null ? (x(id1) ?? 0) : 0
      return { ...t, x: (x0 + x1) / 2, x0, x1 }
    })

    return { margin, innerW, innerH, x, y, midY, paths, cities, ticks }
  }, [payload, size.w, size.h])

  if (!payload || source === 'industry') {
    return (
      <div className="theme-river theme-river--empty" aria-hidden>
        <p>No WHO HA/HSD for industry</p>
      </div>
    )
  }

  if (!layout && !collapsed) return null

  const activeId = localHover ?? focusId
  const activeIdx =
    layout && activeId
      ? layout.cities.findIndex((c) => c.id === activeId)
      : -1
  const activeCity =
    layout && activeIdx >= 0 ? layout.cities[activeIdx] : null
  const ruleX =
    layout && activeCity != null ? (layout.x(activeCity.id) ?? null) : null

  const onMove = (ev: React.MouseEvent<SVGSVGElement>) => {
    if (!layout) return
    const svg = ev.currentTarget
    const rect = svg.getBoundingClientRect()
    const px = ev.clientX - rect.left - layout.margin.left
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < layout.cities.length; i++) {
      const cx = layout.x(layout.cities[i].id) ?? 0
      const d = Math.abs(cx - px)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    const city = layout.cities[best]
    if (!city) return
    setLocalHover(city.id)
    if (lastNotifiedId.current !== city.id) {
      lastNotifiedId.current = city.id
      onHoverCity(city.id)
    }
  }

  const onLeave = () => {
    setLocalHover(null)
    lastNotifiedId.current = null
    onHoverCity(null)
  }

  const onClick = () => {
    if (!activeCity || !onSelectCity) return
    onSelectCity(activeCity.id)
  }

  return (
    <div
      className={`theme-river${collapsed ? ' theme-river--collapsed' : ''}`}
      ref={wrapRef}
      aria-label="Highly annoyed (HA) and highly sleep disturbed (HSD) ThemeRiver"
    >
      {collapsed ? (
        <button
          type="button"
          className="theme-river__toggle theme-river__toggle--show"
          aria-expanded={false}
          onClick={() => setCollapsed(false)}
        >
          show
        </button>
      ) : (
        <>
          <div className="theme-river__head">
            <span className="theme-river__title">
              People highly annoyed (
              <span className="theme-river__term theme-river__term--ha">HA</span>) /
              highly sleep disturbed (
              <span className="theme-river__term theme-river__term--hsd">HSD</span>) by{' '}
              {source} noise
            </span>
            <button
              type="button"
              className="theme-river__toggle theme-river__toggle--hide"
              aria-expanded={true}
              onClick={() => {
                setLocalHover(null)
                lastNotifiedId.current = null
                onHoverCity(null)
                setCollapsed(true)
              }}
            >
              hide
            </button>
          </div>
          {layout ? (
            <svg
              className="theme-river__svg"
              width={size.w}
              height={size.h}
              onMouseMove={onMove}
              onMouseLeave={onLeave}
              onClick={onClick}
              role="img"
              style={{ cursor: activeCity ? 'pointer' : undefined }}
            >
              <g transform={`translate(${layout.margin.left},${layout.margin.top})`}>
                <line
                  className="theme-river__baseline"
                  x1={0}
                  x2={layout.innerW}
                  y1={layout.midY}
                  y2={layout.midY}
                />
                {layout.paths.map((p) => (
                  <path
                    key={p.key}
                    className={`theme-river__stream theme-river__stream--${p.key}`}
                    d={p.d}
                    fill={STREAM_COLORS[p.key].fill}
                    stroke={STREAM_COLORS[p.key].stroke}
                  />
                ))}
                {ruleX != null ? (
                  <line
                    className="theme-river__rule"
                    x1={ruleX}
                    x2={ruleX}
                    y1={0}
                    y2={layout.innerH}
                  />
                ) : null}
                {layout.ticks.map((t, ti) => {
                  const prev = layout.ticks[ti - 1]
                  if (prev && Math.abs(t.x - prev.x) < 42) return null
                  const label =
                    layout.ticks.length > 18 && t.country.length > 10
                      ? t.country.slice(0, 3).toUpperCase()
                      : t.country
                  return (
                    <g
                      key={t.country}
                      transform={`translate(${t.x},${layout.innerH + 12})`}
                    >
                      <text className="theme-river__tick" textAnchor="middle">
                        {label}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>
          ) : null}
          {activeCity ? (
            <div
              className="theme-river__tip"
              style={{
                left:
                  ruleX != null ? layout!.margin.left + ruleX + 10 : 12,
              }}
            >
              <div className="tip-name">{activeCity.agglomeration}</div>
              <div className="tip-sub">{activeCity.country}</div>
              <div className="tip-row ha">
                HA <strong>{formatPeople(activeCity.ha)}</strong>
              </div>
              <div className="tip-row hsd">
                HSD <strong>{formatPeople(activeCity.hsd)}</strong>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
