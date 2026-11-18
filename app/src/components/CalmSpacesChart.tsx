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
  const [size, setSize] = useState({ w: 880, h: 200 })
  const [localHover, setLocalHover] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el || hidden || collapsed) return
    const apply = (width: number, height: number) => {
      setSize({ w: Math.max(320, width), h: Math.max(140, height) })
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
  }, [hidden, collapsed])

  const places = useMemo(
    () => (data?.places ?? []).filter((p) => p.kind !== 'policy'),
    [data],
  )
  const points = useMemo(() => buildCalmPoints(places), [places])
  const ordered = useMemo(() => orderCalmPlaces(places), [places])

  const layout = useMemo(() => {
    if (ordered.length < 2) return null
    const margin = { top: 16, right: 18, bottom: 36, left: 42 }
    const innerW = size.w - margin.left - margin.right
    const innerH = size.h - margin.top - margin.bottom
    const ids = ordered.map((p) => p.id)
    const x = scalePoint<string>().domain(ids).range([0, innerW]).padding(0.35)
    const dbs = points.map((p) => p.db)
    const yMin = Math.min(...dbs, 5)
    const yMax = Math.max(...dbs, 60)
    const y = scaleLinear()
      .domain([yMin - 2, yMax + 3])
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
        <span className="calm-chart__title">
          Calm spaces — quieter places to visit
          <span className="calm-chart__legend">
            <span className="calm-chart__swatch calm-chart__swatch--day" /> day
            <span className="calm-chart__swatch calm-chart__swatch--night" /> night
          </span>
        </span>
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
              <text className="calm-chart__y-tick" x={-8} y={3} textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {layout.bands.map((b) => (
            <text
              key={b.continent}
              className="calm-chart__band"
              x={(b.x0 + b.x1) / 2}
              y={layout.innerH + 28}
              textAnchor="middle"
            >
              {b.continent}
            </text>
          ))}
          {points.map((pt) => {
            const cx = layout.x(pt.placeId) ?? 0
            const cy = layout.y(pt.db)
            const r = quietnessRadius(pt.db, dbExtent.min, dbExtent.max, 4.5, 11)
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
          {/* sparse place labels — loudest/quietest + focus */}
          {ordered.map((p, i) => {
            const show =
              activeId === p.id ||
              i === 0 ||
              i === ordered.length - 1 ||
              (p.storytelling_rank != null && p.storytelling_rank <= 3)
            if (!show) return null
            const cx = layout.x(p.id) ?? 0
            return (
              <text
                key={`lbl-${p.id}`}
                className={`calm-chart__label${activeId === p.id ? ' is-focus' : ''}`}
                x={cx}
                y={-4}
                textAnchor="middle"
              >
                {p.shortLabel}
              </text>
            )
          })}
        </g>
      </svg>
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
