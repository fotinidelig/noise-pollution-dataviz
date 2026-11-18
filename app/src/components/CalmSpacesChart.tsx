import { useEffect, useMemo, useRef, useState } from 'react'
import { scaleLinear, scalePoint } from 'd3-scale'
import {
  buildCalmPoints,
  orderCalmPlaces,
  quietnessRadius,
  type CalmPlace,
  type CalmSpacesData,
} from '../lib/calmSpaces'
import './CalmSpacesChart.css'

type Props = {
  data: CalmSpacesData | null
  focusId: string | null
  onHoverPlace: (id: string | null) => void
  collapsed?: boolean
}

const DAY = '#7eb8a8'
const NIGHT = '#5b7fbf'

export function CalmSpacesChart({
  data,
  focusId,
  onHoverPlace,
  collapsed = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 880, h: 220 })
  const [localHover, setLocalHover] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const el = plotRef.current
    if (!el || hidden || collapsed) return
    const apply = (width: number, height: number) => {
      setSize({ w: Math.max(320, width), h: Math.max(160, height) })
    }
    const rect = el.getBoundingClientRect()
    apply(rect.width, rect.height)
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r || r.height < 60) return
      apply(r.width, r.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [hidden, collapsed])

  const places = useMemo(
    () => (data?.places ?? []).filter((p) => p.kind !== 'policy'),
    [data],
  )
  const points = useMemo(() => buildCalmPoints(places), [places])
  const ordered = useMemo(() => orderCalmPlaces(places), [places])

  const layout = useMemo(() => {
    if (ordered.length < 2) return null
    const margin = { top: 22, right: 14, bottom: 34, left: 42 }
    const innerW = Math.max(40, size.w - margin.left - margin.right)
    const innerH = Math.max(40, size.h - margin.top - margin.bottom)
    const ids = ordered.map((p) => p.id)
    const x = scalePoint<string>().domain(ids).range([0, innerW]).padding(0.35)
    const dbs = points.map((p) => p.db)
    const yMin = Math.min(...dbs, 5)
    const yMax = Math.max(...dbs, 60)
    const y = scaleLinear()
      .domain([yMin - 4, yMax + 5])
      .range([innerH, 0])
      .nice()

    // Continent band labels
    const bands: { continent: string; x0: number; x1: number }[] = []
    let i = 0
    while (i < ordered.length) {
      const c = ordered[i].continent
      let j = i
      while (j < ordered.length && ordered[j].continent === c) j += 1
      const x0 = x(ordered[i].id) ?? 0
      const x1 = x(ordered[j - 1].id) ?? 0
      bands.push({ continent: c, x0, x1 })
      i = j
    }

    return { margin, innerW, innerH, x, y, bands, yMin, yMax }
  }, [ordered, points, size.w, size.h])

  if (!data || !places.length) return null

  if (hidden) {
    return (
      <div
        className="calm-chart calm-chart--collapsed"
        ref={wrapRef}
        role="region"
        aria-label="Calm spaces chart collapsed"
      >
        <button
          type="button"
          className="calm-chart__toggle calm-chart__toggle--show"
          aria-expanded={false}
          onClick={() => setHidden(false)}
        >
          show
        </button>
      </div>
    )
  }

  if (!layout) return null

  const activeId = localHover ?? focusId
  const activePlace = activeId
    ? ordered.find((p) => p.id === activeId) ?? null
    : null

  const onMove = (ev: React.MouseEvent<SVGSVGElement>) => {
    const svg = ev.currentTarget
    const rect = svg.getBoundingClientRect()
    const px = ev.clientX - rect.left - layout.margin.left
    let best: CalmPlace | null = null
    let bestDist = Infinity
    for (const p of ordered) {
      const cx = layout.x(p.id) ?? 0
      const d = Math.abs(cx - px)
      if (d < bestDist) {
        bestDist = d
        best = p
      }
    }
    if (!best || bestDist > 28) {
      if (localHover) {
        setLocalHover(null)
        onHoverPlace(null)
      }
      return
    }
    setLocalHover(best.id)
    onHoverPlace(best.id)
  }

  const onLeave = () => {
    setLocalHover(null)
    onHoverPlace(null)
  }

  const dbExtent = {
    min: Math.min(...points.map((p) => p.db)),
    max: Math.max(...points.map((p) => p.db)),
  }

  return (
    <div
      className="calm-chart"
      ref={wrapRef}
      aria-label="Calm spaces scatter — day and night levels by place"
    >
      <div className="calm-chart__head">
        <div className="calm-chart__head-main">
          <span className="calm-chart__title">
            Places where you might hear birds
          </span>
          <span className="calm-chart__legend" aria-hidden={false}>
            <span className="calm-chart__swatch calm-chart__swatch--day" />
            <span className="calm-chart__legend-label">day</span>
            <span className="calm-chart__swatch calm-chart__swatch--night" />
            <span className="calm-chart__legend-label">night</span>
          </span>
        </div>
        <button
          type="button"
          className="calm-chart__toggle calm-chart__toggle--hide"
          aria-expanded={true}
          onClick={() => {
            setLocalHover(null)
            onHoverPlace(null)
            setHidden(true)
          }}
        >
          hide
        </button>
      </div>
      <div className="calm-chart__plot" ref={plotRef}>
        <svg
          className="calm-chart__svg"
          width={size.w}
          height={size.h}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          role="img"
        >
          <g transform={`translate(${layout.margin.left},${layout.margin.top})`}>
            {layout.y.ticks(5).map((t) => (
              <g key={t} transform={`translate(0,${layout.y(t)})`}>
                <line
                  className="calm-chart__grid"
                  x1={0}
                  x2={layout.innerW}
                  y1={0}
                  y2={0}
                />
                <text className="calm-chart__y-tick" x={-8} y={4} textAnchor="end">
                  {t}
                </text>
              </g>
            ))}
            {layout.bands.map((b) => (
              <text
                key={b.continent}
                className="calm-chart__band"
                x={(b.x0 + b.x1) / 2}
                y={layout.innerH + 22}
                textAnchor="middle"
              >
                {b.continent}
              </text>
            ))}
            {points.map((pt) => {
              const cx = layout.x(pt.placeId) ?? 0
              const cy = layout.y(pt.db)
              const r = quietnessRadius(pt.db, dbExtent.min, dbExtent.max, 4, 9.5)
              const focused = activeId === pt.placeId
              return (
                <circle
                  key={`${pt.placeId}-${pt.period}`}
                  className={`calm-chart__dot calm-chart__dot--${pt.period}${focused ? ' is-focus' : ''}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={pt.period === 'day' ? DAY : NIGHT}
                  stroke="rgba(255,255,255,0.35)"
                  opacity={activeId && !focused ? 0.28 : 0.9}
                />
              )
            })}
            {/* Place name only while hovered / focused from map */}
            {activePlace ? (
              <text
                className="calm-chart__label is-focus"
                x={layout.x(activePlace.id) ?? 0}
                y={10}
                textAnchor="middle"
              >
                {activePlace.shortLabel}
              </text>
            ) : null}
          </g>
        </svg>
      </div>
      {activePlace ? (
        <div className="calm-chart__tip">
          <div className="tip-name">{activePlace.label}</div>
          <div className="tip-sub">
            {activePlace.city} · {activePlace.country}
          </div>
          {activePlace.day_db != null ? (
            <div className="tip-row day">
              Day <strong>{activePlace.day_db.toFixed(1)} dB</strong>
            </div>
          ) : null}
          {activePlace.night_db != null ? (
            <div className="tip-row night">
              Night <strong>{activePlace.night_db.toFixed(1)} dB</strong>
            </div>
          ) : null}
          <div className="tip-metric">{activePlace.metric}</div>
        </div>
      ) : null}
    </div>
  )
}
