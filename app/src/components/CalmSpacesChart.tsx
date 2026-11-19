import { useEffect, useMemo, useRef, useState } from 'react'
import { scaleLinear, scalePoint } from 'd3-scale'
import { select } from 'd3-selection'
import 'd3-transition'
import {
  buildCalmPoints,
  orderCalmPlaces,
  quietnessRadius,
  type CalmPeriod,
  type CalmPlace,
  type CalmPoint,
  type CalmSpacesData,
} from '../lib/calmSpaces'
import {
  NatureClipPlayer,
  natureClipForPeriod,
} from '../scrolly/natureAudio'
import './CalmSpacesChart.css'

export type CalmScatterPreview = {
  /** Stable id: `${placeId}-${period}`. */
  id: string
  placeId: string
  period: CalmPeriod
  db: number
}

type Props = {
  data: CalmSpacesData | null
  focusId: string | null
  onHoverPlace: (id: string | null) => void
  collapsed?: boolean
  /** When false (leave calm step), stop nature preview. */
  active?: boolean
  /**
   * Bump to force-stop without leaving calm (DbPlay / SoundScale took over).
   * Chart stays interactive so the user can switch back to a point.
   */
  haltToken?: number
  /** Controlled preview so the parent can drive SoundGrainOverlay. */
  preview?: CalmScatterPreview | null
  onPreviewChange?: (preview: CalmScatterPreview | null) => void
}

const DAY = '#7eb8a8'
const NIGHT = '#5b7fbf'

function pointId(pt: Pick<CalmPoint, 'placeId' | 'period'>): string {
  return `${pt.placeId}-${pt.period}`
}

function previewFromPoint(pt: CalmPoint): CalmScatterPreview {
  return {
    id: pointId(pt),
    placeId: pt.placeId,
    period: pt.period,
    db: pt.db,
  }
}

export function CalmSpacesChart({
  data,
  focusId,
  onHoverPlace,
  collapsed = false,
  active = true,
  haltToken = 0,
  preview = null,
  onPreviewChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<HTMLDivElement | null>(null)
  const dotsGRef = useRef<SVGGElement | null>(null)
  const playerRef = useRef<NatureClipPlayer | null>(null)
  const activeRef = useRef(active)
  const previewRef = useRef(preview)
  const onPreviewChangeRef = useRef(onPreviewChange)
  const [size, setSize] = useState({ w: 880, h: 220 })
  const [localHover, setLocalHover] = useState<string | null>(null)
  const [hoverPointId, setHoverPointId] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  activeRef.current = active
  previewRef.current = preview
  onPreviewChangeRef.current = onPreviewChange

  if (!playerRef.current) playerRef.current = new NatureClipPlayer()

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

  const hardStop = () => {
    playerRef.current?.stop()
    onPreviewChangeRef.current?.(null)
  }

  // Leave calm step: hard-clear preview + audio.
  useEffect(() => {
    if (!active) hardStop()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop when leaving calm
  }, [active])

  // Shared halt with DbPlay / SoundScale.
  useEffect(() => {
    if (haltToken > 0) hardStop()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent bumps token
  }, [haltToken])

  // Drive nature clip from controlled preview (generation token inside player).
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (!active || !preview) {
      player.stop()
      return
    }
    void player.play(natureClipForPeriod(preview.period), preview.db)
  }, [active, preview])

  useEffect(() => {
    return () => {
      playerRef.current?.dispose()
      playerRef.current = null
      onPreviewChangeRef.current?.(null)
    }
  }, [])

  const activeId = localHover ?? focusId
  const activePlace = activeId
    ? ordered.find((p) => p.id === activeId) ?? null
    : null
  const playingId = preview?.id ?? null

  // Efficient D3 opacity tween on focus leave/enter — avoid React remount flash.
  useEffect(() => {
    const node = dotsGRef.current
    if (!node) return
    const focus = activeId
    select(node)
      .selectAll<SVGCircleElement, unknown>('circle.calm-chart__dot')
      .interrupt()
      .transition()
      .duration(180)
      .attr('opacity', function () {
        if (!focus) return 0.9
        const id = this.getAttribute('data-place-id')
        return id === focus ? 0.9 : 0.28
      })
  }, [activeId])

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

  const dbExtent = {
    min: Math.min(...points.map((p) => p.db)),
    max: Math.max(...points.map((p) => p.db)),
  }

  const nearestPoint = (
    px: number,
    py: number,
  ): { place: CalmPlace; point: CalmPoint; dist: number } | null => {
    let best: CalmPoint | null = null
    let bestDist = Infinity
    for (const pt of points) {
      const cx = layout.x(pt.placeId) ?? 0
      const cy = layout.y(pt.db)
      const d = Math.hypot(cx - px, cy - py)
      const hitR = quietnessRadius(pt.db, dbExtent.min, dbExtent.max, 4, 9.5) + 10
      if (d < bestDist && d <= hitR) {
        bestDist = d
        best = pt
      }
    }
    if (!best) return null
    return { place: best.place, point: best, dist: bestDist }
  }

  const onMove = (ev: React.MouseEvent<SVGSVGElement>) => {
    const svg = ev.currentTarget
    const rect = svg.getBoundingClientRect()
    const px = ev.clientX - rect.left - layout.margin.left
    const py = ev.clientY - rect.top - layout.margin.top
    const hit = nearestPoint(px, py)
    if (!hit) {
      if (localHover) {
        setLocalHover(null)
        onHoverPlace(null)
      }
      if (hoverPointId) setHoverPointId(null)
      return
    }
    setLocalHover(hit.place.id)
    onHoverPlace(hit.place.id)
    setHoverPointId(pointId(hit.point))
  }

  const onLeave = () => {
    setLocalHover(null)
    setHoverPointId(null)
    onHoverPlace(null)
  }

  const togglePoint = (pt: CalmPoint) => {
    if (!activeRef.current) return
    const id = pointId(pt)
    if (previewRef.current?.id === id) {
      hardStop()
      return
    }
    onPreviewChangeRef.current?.(previewFromPoint(pt))
  }

  const overPoint = Boolean(hoverPointId)
  const overPlaying = Boolean(hoverPointId && hoverPointId === playingId)

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
            setHoverPointId(null)
            onHoverPlace(null)
            setHidden(true)
            hardStop()
          }}
        >
          hide
        </button>
      </div>
      <div className="calm-chart__plot" ref={plotRef}>
        <svg
          className={`calm-chart__svg${overPoint ? ' is-over-dot' : ''}${overPlaying ? ' is-playing-dot' : ''}`}
          width={size.w}
          height={size.h}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          onClick={(ev) => {
            const svg = ev.currentTarget
            const rect = svg.getBoundingClientRect()
            const px = ev.clientX - rect.left - layout.margin.left
            const py = ev.clientY - rect.top - layout.margin.top
            const hit = nearestPoint(px, py)
            if (!hit) return
            ev.preventDefault()
            ev.stopPropagation()
            togglePoint(hit.point)
          }}
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
            <g ref={dotsGRef}>
              {points.map((pt) => {
                const cx = layout.x(pt.placeId) ?? 0
                const cy = layout.y(pt.db)
                const r = quietnessRadius(pt.db, dbExtent.min, dbExtent.max, 4, 9.5)
                const focused = activeId === pt.placeId
                const id = pointId(pt)
                const playing = playingId === id
                return (
                  <circle
                    key={id}
                    className={`calm-chart__dot calm-chart__dot--${pt.period}${focused ? ' is-focus' : ''}${playing ? ' is-playing' : ''}`}
                    data-place-id={pt.placeId}
                    data-point-id={id}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={pt.period === 'day' ? DAY : NIGHT}
                    stroke="rgba(255,255,255,0.35)"
                    opacity={0.9}
                  />
                )
              })}
            </g>
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
          {preview && preview.placeId === activePlace.id ? (
            <div className="tip-play">
              {preview.period === 'day' ? 'Day' : 'Night'} · hearing{' '}
              {preview.db.toFixed(1)} dB
            </div>
          ) : (
            <div className="tip-play tip-play--hint">Click a point to hear</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
