import { useEffect, useMemo, useRef, useState } from 'react'
import type { Feature, FeatureCollection, Point } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import { motion } from 'motion/react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { titleFade } from '../scrolly/motionPresets'
import { hydrateChartCities } from '../lib/chartData'
import {
  EUROPE_BOUNDS,
  METRICS,
  metricLabel,
  SOURCES,
  type NoiseMetric,
  type NoiseSource,
} from '../lib/noiseStyle'
import {
  buildCountryAggregates,
  countriesToGeoJSON,
  seriesFromBands,
  tipFromProps,
} from '../lib/countryAggregates'
import {
  aggregateBands,
  buildEqualSpacedRings,
} from '../lib/ringGeometry'
import {
  CityWaveChart,
  type ChartCity,
  type ChartSeries,
  type HoverSeries,
} from './CityWaveChart'
import { ThemeRiverChart, type StreamData } from './ThemeRiverChart'
import {
  CalmSpacesChart,
  type CalmScatterPreview,
} from './CalmSpacesChart'
import {
  calmPlacesToGeoJSON,
  type CalmSpacesData,
} from '../lib/calmSpaces'
import './NoiseMap.css'

const CITIES_SOURCE = 'aggl-cities'
const COUNTRIES_SOURCE = 'aggl-countries'
const RINGS_SOURCE = 'aggl-rings-dyn'
/** Static exposure rings — hover dimming only; never painted by the pulse rAF. */
const RINGS_LAYER = 'aggl-rings'
/** Outer traveling sound-wave — separate layer so hover hit-testing stays snappy. */
const RINGS_PULSE_LAYER = 'aggl-rings-pulse'
/** Stops cover large agglomerations (bands × max rings + outer). */
const RING_PULSE_BUCKETS = 64
/** Crest repeats every N rings so a city stack shows a clear travelling wave. */
const RING_PULSE_PERIOD = 8
/** Soft cyan-gray (less chroma than neon band colours). */
const PULSE_LINE_COLOR = '#9bb7c2'
/** Soft magenta — story-mode country borders only. */
const STORY_COUNTRY_BORDER = '#F56DC0'
/** Carto Dark Matter defaults — restored in exploration mode. */
const EXPLORE_COUNTRY_OUTLINE_COLOR = '#2C353C'
const EXPLORE_COUNTRY_OUTLINE_OPACITY = 0.5
/** Zoom-interpolated Carto inner border (was style `stops`). */
const EXPLORE_COUNTRY_INNER_COLOR: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  4,
  'rgba(92, 94, 94, 1)',
  5,
  'rgba(96, 96, 96, 1)',
  6,
  'rgba(102, 102, 102, 1)',
]
/**
 * Intermittent pulse for in-view stacks (burst → pause → burst).
 * Hover solos one place; layer filter culls off-screen ids (refreshed on rebuild).
 * Burst envelope fades in/out so the pause doesn’t hard-cut like the old continuous wave.
 */
const PULSE_PHASE_STEP = 0.055
const PULSE_TICK_MS = 80
/** Quiet gap between crest travels (no setPaintProperty once faded out). */
const PULSE_PAUSE_MS = 850
/** Fraction of burst phase spent easing opacity up / down. */
const PULSE_FADE_IN = 0.2
const PULSE_FADE_OUT = 0.28
/** Per-ring phase lag for a soft outward cascade. */
const PULSE_STAGGER_PER_RING = 0.035
const PULSE_BURST_FLOOR = 0.06
const PULSE_BURST_PEAK = 0.72
const PULSE_REST_BLUR = 0.2
/** Slightly tighter than ring rebuild pad — pulse work stays near the viewport. */
const PULSE_VIEW_PAD_FRAC = 0.1

/** Smoothstep envelope: 0 at burst edges, 1 in the middle. */
function pulseBurstEnvelope(phase: number): number {
  if (phase <= 0 || phase >= 1) return 0
  if (phase < PULSE_FADE_IN) {
    const t = phase / PULSE_FADE_IN
    return t * t * (3 - 2 * t)
  }
  if (phase > 1 - PULSE_FADE_OUT) {
    const t = (1 - phase) / PULSE_FADE_OUT
    return t * t * (3 - 2 * t)
  }
  return 1
}

/** Wide invisible pad — primary hover/click target around each city/cluster. */
const HIT_PAD_LAYER = 'aggl-hit-pad'
/** Small cyan center dot (visual only). */
const HIT_LAYER = 'aggl-hit'
const LABEL_LAYER = 'aggl-labels'
/** Wide invisible pad for country centers (overview). */
const COUNTRY_HIT_PAD_LAYER = 'aggl-country-hit-pad'
/** Small cyan country center dot (visual only). */
const COUNTRY_HIT_LAYER = 'aggl-country-hit'
const COUNTRY_LABEL_LAYER = 'aggl-country-labels'
/** Matches `rebuildRings` country-view cutoff (`zoom < 5`). */
const COUNTRY_VIEW_MAX_ZOOM = 5
/** Matches cities GeoJSON `clusterMaxZoom`. */
const CITY_CLUSTER_MAX_ZOOM = 8
/** First drill past country rings → city/cluster rings (same band as manual zoom). */
const COUNTRY_DRILL_ZOOM = COUNTRY_VIEW_MAX_ZOOM + 0.65
/** Drill past clustered points → individual city rings. */
const CITY_DRILL_ZOOM = CITY_CLUSTER_MAX_ZOOM + 0.55
const DRILL_ZOOM_STEP = 1.45
const DRILL_DURATION_MS = 950
/** Debounce empty hit clears — gaps between hit circles / ring samples. */
const HOVER_CLEAR_MS = 90
const dataUrl = (path: string) => {
  const base = import.meta.env.BASE_URL || '/'
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${base}${p}`
}
const CHART_URL = dataUrl('data/agglomeration_chart.json')
const STREAM_URL = dataUrl('data/agglomeration_ha_hsd_stream.json')
const HK_OVERLAY_META_URL = 'data/hong_kong_l10_overlay.json'
const HK_SAMPLE_URL = dataUrl('data/hong_kong_l10_sample.json')
const SEOUL_SITES_URL = 'data/seoul_road_sites.geojson'
const HK_IMAGE_SRC = 'hk-l10-image'
const HK_IMAGE_LAYER = 'hk-l10-layer'
const SEOUL_SRC = 'seoul-road-sites'
/** Larger soft hit pad so site hover stays easy while waves stay decorative. */
const SEOUL_HIT_LAYER = 'seoul-road-hit'
/** Small cyan center — same language as city ring centers. */
const SEOUL_CENTER_LAYER = 'seoul-road-centers'
const SEOUL_LABEL_LAYER = 'seoul-road-labels'
/** Linear dB → CSS wave scale-end (louder = farther-reaching rings). */
const SEOUL_DB_MIN = 64
const SEOUL_DB_MAX = 74
const SEOUL_WAVE_SCALE_MIN = 1.55
const SEOUL_WAVE_SCALE_MAX = 3.35
const CALM_URL = dataUrl('data/calm_spaces.json')
const CALM_SRC = 'calm-spaces'
const CALM_CIRCLE_LAYER = 'calm-spaces-circles'
const CALM_LABEL_LAYER = 'calm-spaces-labels'

let workerConfigured = false

function ensureMaplibreWorker() {
  if (workerConfigured) return
  maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}maplibre-gl-worker.mjs`)
  workerConfigured = true
}

function formatPeople(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

/** Map Seoul site mean_db → CSS `--seoul-wave-scale` (linear in dB). */
function seoulDbToWaveScale(meanDb: number): number {
  const t = Math.min(
    1,
    Math.max(0, (meanDb - SEOUL_DB_MIN) / (SEOUL_DB_MAX - SEOUL_DB_MIN)),
  )
  return SEOUL_WAVE_SCALE_MIN + t * (SEOUL_WAVE_SCALE_MAX - SEOUL_WAVE_SCALE_MIN)
}

function makeSeoulWaveElement(meanDb: number): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'seoul-wave'
  el.setAttribute('aria-hidden', 'true')
  // Inline so MapLibre marker defaults cannot steal map hover.
  el.style.pointerEvents = 'none'
  el.style.setProperty('--seoul-wave-scale', String(seoulDbToWaveScale(meanDb)))
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement('span')
    ring.className = 'seoul-wave__ring'
    ring.style.pointerEvents = 'none'
    el.appendChild(ring)
  }
  return el
}

function meanDb(metric: NoiseMetric, bands: { band: string; people: number }[]) {
  const mids =
    metric === 'Lden'
      ? { '55-59': 57, '60-64': 62, '65-69': 67, '70-74': 72, '>75': 77 }
      : { '50-54': 52, '55-59': 57, '60-64': 62, '65-69': 67, '>70': 72 }
  let num = 0
  let den = 0
  for (const b of bands) {
    const mid = mids[b.band as keyof typeof mids]
    if (mid == null || b.people <= 0) continue
    num += b.people * mid
    den += b.people
  }
  return den ? Math.round((num / den) * 10) / 10 : null
}

function buildTooltipHtml(
  title: string,
  cityCount: number,
  metric: NoiseMetric,
  bands: { band: string; label: string; color: string; people: number }[],
) {
  const total = bands.reduce((s, b) => s + b.people, 0)
  const mean = meanDb(metric, bands)
  const citiesLabel = `${cityCount} ${cityCount === 1 ? 'city' : 'cities'}`
  const subParts: string[] = []
  if (mean != null) {
    subParts.push(
      `<span class="tip-mean">${mean}dB average ${metricLabel(metric)}</span>`,
    )
  }
  subParts.push(citiesLabel)
  // Bands arrive ascending (quiet→loud); tip lists loud→quiet.
  const rows = bands
    .filter((b) => b.people > 0)
    .slice()
    .reverse()
    .map(
      (b) =>
        `<div class="tip-row"><span class="tip-swatch" style="background:${b.color}"></span><span>${b.label}</span><span class="tip-num">${formatPeople(b.people)}</span></div>`,
    )
    .join('')

  return `
    <div class="tip">
      <div class="tip-title">${title}</div>
      <div class="tip-sub">${subParts.join(' · ')}</div>
      <div class="tip-total">${formatPeople(total)} people recorded</div>
      <div class="tip-bands">${rows || '<div class="tip-empty">No exposure reported</div>'}</div>
    </div>
  `
}

type CityPointProps = {
  id: string
  agglomeration: string
  country: string
  inhabitants: number
  tooltip: string
}

async function getClusterLeaves(
  source: maplibregl.GeoJSONSource,
  clusterId: number,
): Promise<Feature[]> {
  return source.getClusterLeaves(clusterId, Infinity, 0)
}

/** Padded viewport box — only build city/cluster rings inside it. */
type PadBounds = {
  west: number
  east: number
  south: number
  north: number
}

function padMapBounds(
  bounds: maplibregl.LngLatBounds,
  padFrac = 0.14,
): PadBounds {
  const west = bounds.getWest()
  const east = bounds.getEast()
  const south = bounds.getSouth()
  const north = bounds.getNorth()
  const lngPad = Math.max(0.12, (east - west) * padFrac)
  const latPad = Math.max(0.08, (north - south) * padFrac)
  return {
    west: west - lngPad,
    east: east + lngPad,
    south: south - latPad,
    north: north + latPad,
  }
}

function inPadBounds(lon: number, lat: number, box: PadBounds): boolean {
  return (
    lon >= box.west &&
    lon <= box.east &&
    lat >= box.south &&
    lat <= box.north
  )
}

/** Step zoom like manual scroll: at least `floor`, else +DRILL_ZOOM_STEP. */
function nextDrillZoom(currentZoom: number, floor: number): number {
  return Math.min(12, Math.max(currentZoom + DRILL_ZOOM_STEP, floor))
}

function easeDrillTo(
  map: maplibregl.Map,
  center: [number, number],
  floorZoom: number,
) {
  map.easeTo({
    center,
    zoom: nextDrillZoom(map.getZoom(), floorZoom),
    duration: DRILL_DURATION_MS,
    essential: true,
  })
}

/** Fit a country’s cities, capped so the first click lands in the cluster band. */
function fitCountryDrill(
  map: maplibregl.Map,
  cities: ChartCity[],
  country: string,
  fallback: [number, number],
) {
  const pts = cities.filter(
    (c) =>
      c.country === country &&
      typeof c.lon === 'number' &&
      typeof c.lat === 'number',
  )
  if (pts.length === 0) {
    easeDrillTo(map, fallback, COUNTRY_DRILL_ZOOM)
    return
  }
  if (pts.length === 1) {
    easeDrillTo(map, [pts[0].lon as number, pts[0].lat as number], COUNTRY_DRILL_ZOOM)
    return
  }
  const firstLon = pts[0].lon as number
  const firstLat = pts[0].lat as number
  const bounds = new maplibregl.LngLatBounds(
    [firstLon, firstLat],
    [firstLon, firstLat],
  )
  for (const p of pts) bounds.extend([p.lon as number, p.lat as number])
  const z = map.getZoom()
  // Stay below city-leaf zoom so France → fewer clusters, not every city.
  const maxZoom = Math.min(
    CITY_CLUSTER_MAX_ZOOM - 0.35,
    Math.max(COUNTRY_DRILL_ZOOM + 0.85, z + DRILL_ZOOM_STEP),
  )
  map.fitBounds(bounds, {
    padding: { top: 88, bottom: 72, left: 120, right: 72 },
    maxZoom,
    duration: DRILL_DURATION_MS,
    essential: true,
  })
}

/** Sync hover/tooltip payload — filled in rebuildRings, read on pointer move. */
type HoverTarget = {
  id: string
  series: HoverSeries
  coords: [number, number]
  cityCount: number
  title: string
}

export type StoryMapControl = {
  stepId: string
  center: [number, number]
  zoom: number
  source?: NoiseSource
  metric?: NoiseMetric
  highlightId?: string | null
  explore?: boolean
  /** Soft calm-spaces beat — brighter basemap + bubbles. */
  calm?: boolean
  /** Once unlocked in the story, keep city overlays visible. */
  overlays?: { hongkong?: boolean; seoul?: boolean }
  /** Calm scatter nature preview — active while on the calm beat. */
  calmScatterActive?: boolean
  /** Bump to yield to DbPlay / SoundScale. */
  calmHaltToken?: number
  calmPreview?: CalmScatterPreview | null
  onCalmPreviewChange?: (preview: CalmScatterPreview | null) => void
  /** Session mute — silence story/explore audio; grain viz stays. */
  audioMuted?: boolean
  onAudioMutedChange?: (muted: boolean) => void
}

export type { CalmScatterPreview }

type NoiseMapProps = {
  story?: StoryMapControl | null
}

/** Speaker / muted-speaker affordance next to Story / exploration mode. */
function AudioMuteToggle({
  muted,
  onChange,
}: {
  muted: boolean
  onChange: (muted: boolean) => void
}) {
  return (
    <button
      type="button"
      className={`noise-mute-btn${muted ? ' is-muted' : ''}`}
      aria-pressed={muted}
      aria-label={muted ? 'Unmute audio' : 'Mute audio'}
      title={muted ? 'Unmute audio' : 'Mute audio'}
      onClick={() => onChange(!muted)}
    >
      {muted ? (
        <svg
          className="noise-mute-btn__icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M16.5 12a4.5 4.5 0 0 0-2.4-4l1.1-1.1A6 6 0 0 1 18.5 12c0 1.2-.35 2.3-.95 3.25l-1.15-1.15c.4-.65.6-1.35.6-2.1ZM4.27 3 3 4.27 7.73 9H4v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.73-1.81L19.73 21 21 19.73 4.27 3ZM12 4 9.91 6.09 12 8.18V4Z"
          />
        </svg>
      ) : (
        <svg
          className="noise-mute-btn__icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02ZM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77Z"
          />
        </svg>
      )}
    </button>
  )
}

export function NoiseMap({ story = null }: NoiseMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const citiesRef = useRef<ChartCity[]>([])
  const sourceRef = useRef<NoiseSource>('road')
  const metricRef = useRef<NoiseMetric>('Lden')
  const rebuildTimer = useRef<number | null>(null)
  const rebuildRetryTimer = useRef<number | null>(null)
  const rebuildEmptyRetries = useRef(0)
  const countryModeRef = useRef(false)
  const lastStoryStep = useRef<string | null>(null)
  const pulsePhaseRef = useRef(0)
  const pulseRafRef = useRef<number | null>(null)
  const pulsePauseTimerRef = useRef<number | null>(null)
  /** Agglomeration ids whose centers are inside the padded viewport. */
  const pulseVisibleIdsRef = useRef<string[]>([])
  /** Last pulse layer filter key — skip redundant setFilter. */
  const pulseFilterKeyRef = useRef<string>('')
  const ringFocusIdRef = useRef<string | null>(null)
  const syncPulseRef = useRef<() => void>(() => {})
  const pulseErrorLoggedRef = useRef(false)

  const [source, setSource] = useState<NoiseSource>('road')
  const [metric, setMetric] = useState<NoiseMetric>('Lden')
  const [mapReady, setMapReady] = useState(false)
  const [chartCities, setChartCities] = useState<ChartCity[]>([])
  const [streamData, setStreamData] = useState<StreamData | null>(null)
  const [calmData, setCalmData] = useState<CalmSpacesData | null>(null)
  const [calmFocusId, setCalmFocusId] = useState<string | null>(null)
  /**
   * Label toggle: force explore/story without changing the scrolly beat
   * (keeps the current map camera). `auto` follows the active step.
   */
  const [modeOverride, setModeOverride] = useState<'auto' | 'explore' | 'story'>(
    'auto',
  )

  // New story beat wins — clear manual mode so scroll stays authoritative.
  useEffect(() => {
    setModeOverride('auto')
  }, [story?.stepId])

  // Standalone map = explore; scrolly beats lock until Explore (or label toggle).
  const beatExplore = !story || Boolean(story.explore)
  const explore =
    modeOverride === 'explore'
      ? true
      : modeOverride === 'story'
        ? false
        : beatExplore
  const storyLocked = Boolean(story) && !explore
  const exploreRef = useRef(explore)
  exploreRef.current = explore
  /** Calm bubbles/chart only on the story calm beat (explore no longer has a toggle). */
  const calmMode = Boolean(story?.calm) && !explore
  const calmModeRef = useRef(calmMode)
  calmModeRef.current = calmMode
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoverSeries, setHoverSeries] = useState<HoverSeries | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [pinnedSeries, setPinnedSeries] = useState<HoverSeries | null>(null)
  const [tipAnchor, setTipAnchor] = useState<{
    left: number
    top: number
    height: number
  } | null>(null)
  const pinnedIdRef = useRef<string | null>(null)
  /** Map-pointer owned — never clobber from React render (tipAnchor etc.). */
  const hoveredIdRef = useRef<string | null>(null)
  const focusIdRef = useRef<string | null>(null)
  const hoverGenRef = useRef(0)
  const clearHoverTimer = useRef<number | null>(null)
  /** id → series/coords built with rings; hover stays sync (no getClusterLeaves). */
  const hoverCacheRef = useRef(new Map<string, HoverTarget>())
  const drillingRef = useRef(false)
  const lastTipIdRef = useRef<string | null>(null)
  /** Skip redundant setPaintProperty when focus id is unchanged. */
  const lastPaintedFocusRef = useRef<string | null | undefined>(undefined)
  const hoverMoveRafRef = useRef(0)
  /** CSS sound-wave markers for Seoul sites (pointer-events none). */
  const seoulMarkersRef = useRef<maplibregl.Marker[]>([])
  const seoulSitesDataRef = useRef<FeatureCollection<Point> | null>(null)

  sourceRef.current = source
  metricRef.current = metric
  citiesRef.current = chartCities
  pinnedIdRef.current = pinnedId

  const focusId = hoveredId ?? pinnedId ?? (storyLocked ? story?.highlightId ?? null : null)

  const stopPulseLoop = () => {
    if (pulseRafRef.current != null) {
      window.cancelAnimationFrame(pulseRafRef.current)
      pulseRafRef.current = null
    }
    if (pulsePauseTimerRef.current != null) {
      window.clearTimeout(pulsePauseTimerRef.current)
      pulsePauseTimerRef.current = null
    }
  }

  const pulseLoopActive = () =>
    pulseRafRef.current != null || pulsePauseTimerRef.current != null

  /** Ids that should receive the current burst (hover solo, else in-view). */
  const activePulseIds = (): string[] => {
    const hoverId = hoveredIdRef.current
    if (hoverId) return [hoverId]
    return pulseVisibleIdsRef.current
  }

  /**
   * Cull pulse drawing via layer filter — off-screen stacks stay in GeoJSON
   * but are not painted/animated. Hover always solos to that one id.
   */
  const applyPulseFilter = (ids: string[]) => {
    const map = mapRef.current
    if (!map || !map.getLayer(RINGS_PULSE_LAYER)) return
    const key = ids.length === 0 ? '' : [...ids].sort().join('\0')
    if (key === pulseFilterKeyRef.current) return
    pulseFilterKeyRef.current = key
    try {
      if (ids.length === 0) {
        map.setFilter(RINGS_PULSE_LAYER, [
          'all',
          ['==', ['get', 'role'], 'pulse'],
          ['literal', false],
        ])
      } else if (ids.length === 1) {
        map.setFilter(RINGS_PULSE_LAYER, [
          'all',
          ['==', ['get', 'role'], 'pulse'],
          ['==', ['to-string', ['get', 'id']], ids[0]],
        ])
      } else {
        map.setFilter(RINGS_PULSE_LAYER, [
          'all',
          ['==', ['get', 'role'], 'pulse'],
          ['in', ['to-string', ['get', 'id']], ['literal', ids]],
        ])
      }
    } catch (err) {
      if (!pulseErrorLoggedRef.current) {
        pulseErrorLoggedRef.current = true
        console.warn('[rings pulse] filter failed', err)
      }
    }
  }

  /** Centers inside padded map bounds → eligible for global intermittent pulse. */
  const refreshPulseViewport = () => {
    const map = mapRef.current
    if (!map) {
      pulseVisibleIdsRef.current = []
      return
    }
    const box = padMapBounds(map.getBounds(), PULSE_VIEW_PAD_FRAC)
    const ids: string[] = []
    for (const t of hoverCacheRef.current.values()) {
      if (inPadBounds(t.coords[0], t.coords[1], box)) ids.push(t.id)
    }
    pulseVisibleIdsRef.current = ids
  }

  /** Hide crest between bursts (filter can stay). */
  const paintPulseIdle = () => {
    const map = mapRef.current
    if (!map || !map.getLayer(RINGS_PULSE_LAYER)) return
    try {
      map.setPaintProperty(RINGS_PULSE_LAYER, 'line-opacity', 0)
      map.setPaintProperty(RINGS_PULSE_LAYER, 'line-blur', PULSE_REST_BLUR)
    } catch (err) {
      if (!pulseErrorLoggedRef.current) {
        pulseErrorLoggedRef.current = true
        console.warn('[rings pulse] idle paint failed', err)
      }
    }
  }

  /**
   * One burst frame for whatever the pulse filter currently includes.
   * ring_index stagger softens the cascade; envelope fades the whole stack in/out.
   */
  const paintPulseBurstFrame = (phase: number) => {
    const map = mapRef.current
    if (!map || !map.getLayer(RINGS_PULSE_LAYER)) return
    const env = pulseBurstEnvelope(phase)
    if (env <= 0.001) {
      paintPulseIdle()
      return
    }
    const N = RING_PULSE_BUCKETS
    const opacityStops: number[] = []
    const blurStops: number[] = []
    for (let i = 0; i < N; i++) {
      let t = i / RING_PULSE_PERIOD - phase - i * PULSE_STAGGER_PER_RING
      t = t - Math.floor(t)
      const soft = Math.sin(t * Math.PI) ** 3
      const crest = PULSE_BURST_FLOOR + (PULSE_BURST_PEAK - PULSE_BURST_FLOOR) * soft
      opacityStops.push(i, crest * env)
      blurStops.push(i, PULSE_REST_BLUR + (0.12 + 0.95 * soft - PULSE_REST_BLUR) * env)
    }

    const ringIdx = [
      'coalesce',
      ['to-number', ['get', 'ring_index']],
      0,
    ] as maplibregl.ExpressionSpecification

    try {
      map.setPaintProperty(RINGS_PULSE_LAYER, 'line-opacity', [
        'interpolate',
        ['linear'],
        ringIdx,
        ...opacityStops,
      ] as maplibregl.ExpressionSpecification)
      map.setPaintProperty(RINGS_PULSE_LAYER, 'line-blur', [
        'interpolate',
        ['linear'],
        ringIdx,
        ...blurStops,
      ] as maplibregl.ExpressionSpecification)
    } catch (err) {
      if (!pulseErrorLoggedRef.current) {
        pulseErrorLoggedRef.current = true
        console.warn('[rings pulse] burst paint failed', err)
      }
    }
  }

  /** Schedule the next burst after a quiet pause (shared by crest-end + empty view). */
  const schedulePulseResume = (
    tick: (now: number) => void,
    resetPhase: () => void,
  ) => {
    pulseRafRef.current = null
    pulsePauseTimerRef.current = window.setTimeout(() => {
      pulsePauseTimerRef.current = null
      if (calmModeRef.current) return
      resetPhase()
      const ids = activePulseIds()
      applyPulseFilter(ids)
      if (ids.length > 0) paintPulseBurstFrame(0)
      else paintPulseIdle()
      pulseRafRef.current = window.requestAnimationFrame(tick)
    }, PULSE_PAUSE_MS)
  }

  /** Burst → pause → burst for in-view stacks (or hovered solo). */
  const startIntermittentPulse = () => {
    stopPulseLoop()
    pulsePhaseRef.current = 0
    const ids0 = activePulseIds()
    applyPulseFilter(ids0)
    if (ids0.length === 0) paintPulseIdle()
    else paintPulseBurstFrame(0)

    let last = 0
    const tick = (now: number) => {
      if (calmModeRef.current) {
        stopPulseLoop()
        return
      }
      if (now - last >= PULSE_TICK_MS) {
        last = now
        // Filter updates on hover/rebuild via syncPulse — not every paint tick
        if (activePulseIds().length === 0) {
          paintPulseIdle()
          pulsePhaseRef.current = 0
          schedulePulseResume(tick, () => {
            last = 0
            pulsePhaseRef.current = 0
          })
          return
        }
        pulsePhaseRef.current += PULSE_PHASE_STEP
        if (pulsePhaseRef.current >= 1) {
          paintPulseIdle()
          schedulePulseResume(tick, () => {
            last = 0
            pulsePhaseRef.current = 0
          })
          return
        }
        paintPulseBurstFrame(pulsePhaseRef.current)
      }
      pulseRafRef.current = window.requestAnimationFrame(tick)
    }
    pulseRafRef.current = window.requestAnimationFrame(tick)
  }

  /**
   * Keep intermittent pulse running for in-view stacks.
   * Hover updates the filter to solo; unhover restores everyone in view.
   */
  const syncPulse = () => {
    if (calmModeRef.current) {
      stopPulseLoop()
      pulseFilterKeyRef.current = ''
      paintPulseIdle()
      return
    }
    applyPulseFilter(activePulseIds())
    if (!pulseLoopActive()) {
      startIntermittentPulse()
    }
  }
  syncPulseRef.current = syncPulse

  /** Apply ring/label dimming immediately (skip if focus id unchanged). */
  const applyFocusPaint = (activeId: string | null, force = false) => {
    const map = mapRef.current
    if (!map || !map.getLayer(RINGS_LAYER)) return
    ringFocusIdRef.current = activeId
    // Hover solo / unhover restore — even when static focus paint is skipped
    syncPulse()
    if (!force && lastPaintedFocusRef.current === activeId) return
    lastPaintedFocusRef.current = activeId

    const dimming = Boolean(activeId)
    const id = activeId ?? ''

    // Static rings only — pulse layer is intermittent + filtered (syncPulse)
    map.setPaintProperty(
      RINGS_LAYER,
      'line-opacity',
      dimming
        ? ([
            'case',
            ['==', ['to-string', ['get', 'id']], id],
            0.95,
            0.16,
          ] as maplibregl.ExpressionSpecification)
        : 0.88,
    )
    map.setPaintProperty(
      RINGS_LAYER,
      'line-width',
      dimming
        ? ([
            'case',
            ['==', ['to-string', ['get', 'id']], id],
            ['interpolate', ['linear'], ['zoom'], 3, 1.15, 6, 1.9, 10, 2.6],
            ['interpolate', ['linear'], ['zoom'], 3, 0.4, 6, 0.65, 10, 0.95],
          ] as maplibregl.ExpressionSpecification)
        : ([
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0.7,
            6,
            1.15,
            10,
            1.8,
          ] as maplibregl.ExpressionSpecification),
    )

    if (map.getLayer(LABEL_LAYER)) {
      map.setPaintProperty(
        LABEL_LAYER,
        'text-opacity',
        dimming
          ? ([
              'case',
              ['==', ['to-string', ['get', 'id']], id],
              1,
              0.2,
            ] as maplibregl.ExpressionSpecification)
          : ([
              'interpolate',
              ['linear'],
              ['zoom'],
              5.5,
              0,
              6.5,
              0.9,
            ] as maplibregl.ExpressionSpecification),
      )
    }
    if (map.getLayer(COUNTRY_LABEL_LAYER)) {
      map.setPaintProperty(
        COUNTRY_LABEL_LAYER,
        'text-opacity',
        dimming
          ? ([
              'case',
              ['==', ['to-string', ['get', 'id']], id],
              1,
              0.22,
            ] as maplibregl.ExpressionSpecification)
          : 0.95,
      )
    }
    // Visible ring-center markers stay clickable; dim with focus
    if (map.getLayer(HIT_LAYER)) {
      map.setPaintProperty(
        HIT_LAYER,
        'circle-opacity',
        dimming
          ? ([
              'case',
              [
                'any',
                ['==', ['to-string', ['get', 'id']], id],
                [
                  'all',
                  ['has', 'cluster_id'],
                  [
                    '==',
                    ['concat', 'cluster:', ['to-string', ['get', 'cluster_id']]],
                    id,
                  ],
                ],
              ],
              0.95,
              0.22,
            ] as maplibregl.ExpressionSpecification)
          : 0.92,
      )
    }
    if (map.getLayer(COUNTRY_HIT_LAYER)) {
      map.setPaintProperty(
        COUNTRY_HIT_LAYER,
        'circle-opacity',
        dimming
          ? ([
              'case',
              ['==', ['to-string', ['get', 'id']], id],
              0.95,
              0.22,
            ] as maplibregl.ExpressionSpecification)
          : 0.9,
      )
    }
  }

  const cancelPendingClear = () => {
    if (clearHoverTimer.current != null) {
      window.clearTimeout(clearHoverTimer.current)
      clearHoverTimer.current = null
    }
  }

  const setMapHover = (id: string | null, series: HoverSeries | null) => {
    cancelPendingClear()
    const same = hoveredIdRef.current === id
    hoverGenRef.current += 1
    hoveredIdRef.current = id
    focusIdRef.current = id ?? pinnedIdRef.current
    applyFocusPaint(focusIdRef.current)
    if (id == null) lastTipIdRef.current = null
    // Same city: skip React id churn; still allow series upgrades
    if (same && id != null) {
      if (series) setHoverSeries(series)
      return
    }
    setHoveredId(id)
    setHoverSeries(series)
  }

  /**
   * Suppress hover-clear + ring rebuild mid click-zoom; rebuild once at moveend.
   * Clears hover/pin so previous country/cluster focus cannot dim the next level,
   * and the user must re-hover for a tooltip.
   */
  const beginDrill = (
    run: () => void,
    opts: { clearSelection?: boolean } = {},
  ) => {
    const map = mapRef.current
    if (!map) return
    drillingRef.current = true
    cancelPendingClear()
    if (opts.clearSelection !== false) {
      popupRef.current?.remove()
      lastTipIdRef.current = null
      pinnedIdRef.current = null
      hoveredIdRef.current = null
      focusIdRef.current = null
      applyFocusPaint(null)
      setPinnedId(null)
      setPinnedSeries(null)
      setMapHover(null, null)
      map.getCanvas().style.cursor = ''
    }
    const finish = () => {
      drillingRef.current = false
      scheduleRebuild()
    }
    map.once('moveend', finish)
    run()
  }

  const targetFromCacheOrData = (id: string): HoverTarget | null => {
    if (!id) return null
    const cached = hoverCacheRef.current.get(id)
    if (cached) return cached

    if (id.startsWith('country:')) {
      const country = id.slice('country:'.length)
      const agg = countryAggsRef.current.find((a) => a.country === country)
      if (!agg) return null
      return {
        id: agg.id,
        series: agg.series,
        coords: [agg.lon, agg.lat],
        cityCount: agg.cityCount,
        title: agg.country,
      }
    }

    // Clusters only exist in the rebuild cache
    if (id.startsWith('cluster:')) return null

    const city = citiesRef.current.find((c) => c.id === id)
    if (!city || city.lon == null || city.lat == null) return null
    const tip = city.series[`${sourceRef.current}__${metricRef.current}`]
    if (!tip) return null
    return {
      id,
      series: seriesFromBands(id, city.agglomeration, tip.bands),
      coords: [city.lon, city.lat],
      cityCount: 1,
      title: city.agglomeration,
    }
  }

  const idFromHitProps = (props: Record<string, unknown>): string | null => {
    if (props.kind === 'country') return String(props.id ?? '') || null
    if (props.cluster) {
      const clusterId = Number(props.cluster_id)
      return Number.isFinite(clusterId) ? `cluster:${clusterId}` : null
    }
    return String(props.id ?? '') || null
  }

  /**
   * Rings first (what you see), then hit circles — tip data always from cache/cities.
   * Same path for hover + click; no async on the pointer path.
   */
  const resolveNoiseTarget = (
    map: maplibregl.Map,
    point: maplibregl.PointLike,
  ): HoverTarget | null => {
    if (map.getLayer(RINGS_LAYER)) {
      const ringHits = map.queryRenderedFeatures(point, {
        layers: [RINGS_LAYER],
      })
      const ringId = String(ringHits[0]?.properties?.id ?? '')
      const fromRing = targetFromCacheOrData(ringId)
      if (fromRing) return fromRing
    }

    const hitLayers = countryModeRef.current
      ? [COUNTRY_HIT_PAD_LAYER, COUNTRY_HIT_LAYER]
      : [HIT_PAD_LAYER, HIT_LAYER]
    const present = hitLayers.filter((id) => map.getLayer(id))
    if (!present.length) return null
    const feats = map.queryRenderedFeatures(point, { layers: present })
    if (!feats.length) return null
    return targetFromCacheOrData(idFromHitProps(feats[0].properties ?? {}) ?? '')
  }

  const showNoisePopup = (
    map: maplibregl.Map,
    popup: maplibregl.Popup,
    target: HoverTarget,
  ) => {
    if (lastTipIdRef.current === target.id && popup.isOpen()) return
    lastTipIdRef.current = target.id
    const met = metricRef.current
    popup
      .setLngLat(target.coords)
      .setHTML(
        buildTooltipHtml(
          target.title,
          target.cityCount,
          met,
          target.series.points.map((b) => ({ ...b, rings: 0 })),
        ),
      )
      .addTo(map)
  }

  // Sync story camera / layer locks (scrolly).
  // Mode-label override keeps the current view — never easeTo while overridden.
  useEffect(() => {
    if (!story) return
    if (story.source) setSource(story.source)
    if (story.metric) setMetric(story.metric)
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return
    if (modeOverride !== 'auto') {
      if (story.highlightId && modeOverride === 'story') {
        applyFocusPaint(story.highlightId)
      }
      return
    }
    if (lastStoryStep.current === story.stepId) {
      applyFocusPaint(story.highlightId ?? focusIdRef.current)
      return
    }
    lastStoryStep.current = story.stepId
    map.easeTo({
      center: story.center,
      zoom: story.zoom,
      duration: 1200,
      essential: true,
    })
    if (story.highlightId) {
      hoveredIdRef.current = null
      focusIdRef.current = story.highlightId
      applyFocusPaint(story.highlightId)
    } else if (!story.explore) {
      applyFocusPaint(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapReady,
    story?.stepId,
    story?.center?.[0],
    story?.center?.[1],
    story?.zoom,
    story?.source,
    story?.metric,
    story?.highlightId,
    story?.explore,
    modeOverride,
  ])

  // Story: pan allowed, zoom locked (cameras still fly programmatically).
  // Explore: restore pan + zoom + nav chrome.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const zoomHandlers = [
      map.scrollZoom,
      map.touchZoomRotate,
      map.doubleClickZoom,
      map.boxZoom,
      map.keyboard,
      map.dragRotate,
    ] as const
    map.dragPan.enable()
    if (storyLocked) {
      for (const h of zoomHandlers) h.disable()
    } else {
      for (const h of zoomHandlers) h.enable()
    }
    const nav = document.querySelector('.maplibregl-ctrl-bottom-right') as HTMLElement | null
    if (nav) nav.style.display = storyLocked ? 'none' : ''
  }, [storyLocked, story?.stepId, mapReady])

  // Country borders: magenta in story only; Carto defaults in exploration.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const paintBorders = (magenta: boolean) => {
      try {
        if (map.getLayer('boundary_country_outline')) {
          map.setPaintProperty(
            'boundary_country_outline',
            'line-color',
            magenta ? STORY_COUNTRY_BORDER : EXPLORE_COUNTRY_OUTLINE_COLOR,
          )
          map.setPaintProperty(
            'boundary_country_outline',
            'line-opacity',
            magenta ? 0.85 : EXPLORE_COUNTRY_OUTLINE_OPACITY,
          )
        }
      } catch {
        /* style variant */
      }
      try {
        if (map.getLayer('boundary_country_inner')) {
          map.setPaintProperty(
            'boundary_country_inner',
            'line-color',
            magenta ? STORY_COUNTRY_BORDER : EXPLORE_COUNTRY_INNER_COLOR,
          )
        }
      } catch {
        /* */
      }
    }
    paintBorders(storyLocked)
  }, [storyLocked, mapReady])

  // Intermittent pulse for in-view stacks (hover solos via syncPulse)
  useEffect(() => {
    if (!mapReady) return
    refreshPulseViewport()
    syncPulseRef.current()
    return () => {
      stopPulseLoop()
      pulseFilterKeyRef.current = ''
    }
  }, [mapReady])

  // Dock wave chart to the right of the MapLibre hover/pin tooltip
  useEffect(() => {
    const wrap = containerRef.current?.parentElement
    if (!wrap) return
    let raf = 0
    const sync = () => {
      const tip = wrap.querySelector('.noise-tip') as HTMLElement | null
      const wrapBox = wrap.getBoundingClientRect()
      if (!tip || tip.offsetParent === null) {
        setTipAnchor(null)
        return
      }
      const r = tip.getBoundingClientRect()
      if (r.width < 8 || r.height < 8) {
        setTipAnchor(null)
        return
      }
      setTipAnchor({
        left: r.right - wrapBox.left + 2,
        top: r.top - wrapBox.top,
        height: Math.max(120, r.height),
      })
    }
    const onMove = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        sync()
      })
    }
    sync()
    const map = mapRef.current
    map?.on('move', onMove)
    map?.on('zoom', onMove)
    const mo = new MutationObserver(onMove)
    mo.observe(wrap, { childList: true, subtree: true, attributes: true })
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      map?.off('move', onMove)
      map?.off('zoom', onMove)
      mo.disconnect()
    }
  }, [mapReady, hoveredId, pinnedId, focusId])

  // Soften dark-matter water/land on the calm story beat (and explore calm toggle)
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return
    const soften = (on: boolean) => {
      const water = 'water'
      const land = 'landcover'
      const bg = 'background'
      try {
        if (map.getLayer(bg)) {
          map.setPaintProperty(
            bg,
            'background-color',
            on ? '#1a2228' : '#03050a',
          )
        }
      } catch {
        /* style variant */
      }
      try {
        if (map.getLayer(water)) {
          map.setPaintProperty(water, 'fill-color', on ? '#2a3844' : '#1F2C3C')
          map.setPaintProperty(water, 'fill-opacity', on ? 0.92 : 1)
        }
      } catch {
        /* */
      }
      // Dark-matter also uses waterway / water label variants — lighten if present
      for (const id of ['waterway', 'waterway_tunnel', 'water_name_line', 'water_name_point']) {
        try {
          if (!map.getLayer(id)) continue
          if (map.getPaintProperty(id, 'line-color') != null) {
            map.setPaintProperty(id, 'line-color', on ? '#3d5160' : '#1a2834')
          }
        } catch {
          /* */
        }
      }
      try {
        if (map.getLayer(land)) {
          map.setPaintProperty(land, 'fill-opacity', on ? 0.55 : 0.8)
        }
      } catch {
        /* */
      }
      // Dim noise rings while calm bubbles speak; pulse stays off in calm
      if (map.getLayer(RINGS_LAYER)) {
        map.setPaintProperty(RINGS_LAYER, 'line-opacity', on ? 0.22 : 0.88)
      }
      if (map.getLayer(RINGS_PULSE_LAYER)) {
        if (on) {
          stopPulseLoop()
          pulseFilterKeyRef.current = ''
          map.setPaintProperty(RINGS_PULSE_LAYER, 'line-opacity', 0)
        } else {
          refreshPulseViewport()
          syncPulseRef.current()
        }
      }
    }
    soften(calmMode)
  }, [mapReady, calmMode, story?.stepId])

  // Calm space bubbles — story calm step or explore toggle
  useEffect(() => {
    if (!mapReady || !calmData) return
    const map = mapRef.current
    if (!map) return
    let cancelled = false
    const geo = calmPlacesToGeoJSON(calmData.places)

    const ensure = () => {
      if (cancelled) return
      if (!map.getSource(CALM_SRC)) {
        map.addSource(CALM_SRC, { type: 'geojson', data: geo })
      } else {
        ;(map.getSource(CALM_SRC) as maplibregl.GeoJSONSource).setData(geo)
      }
      if (!map.getLayer(CALM_CIRCLE_LAYER)) {
        map.addLayer({
          id: CALM_CIRCLE_LAYER,
          type: 'circle',
          source: CALM_SRC,
          layout: { visibility: calmMode ? 'visible' : 'none' },
          paint: {
            // Lower quiet_db → larger bubble
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'quiet_db'],
              10,
              28,
              25,
              20,
              40,
              12,
              55,
              8,
            ],
            'circle-color': '#7eb8a8',
            'circle-opacity': 0.72,
            'circle-stroke-color': [
              'case',
              ['==', ['get', 'id'], calmFocusId ?? ''],
              '#f2f7f3',
              'rgba(236, 244, 236, 0.55)',
            ],
            'circle-stroke-width': [
              'case',
              ['==', ['get', 'id'], calmFocusId ?? ''],
              2.2,
              1.1,
            ],
          },
        })
      } else {
        map.setLayoutProperty(
          CALM_CIRCLE_LAYER,
          'visibility',
          calmMode ? 'visible' : 'none',
        )
        map.setPaintProperty(CALM_CIRCLE_LAYER, 'circle-stroke-color', [
          'case',
          ['==', ['get', 'id'], calmFocusId ?? ''],
          '#f2f7f3',
          'rgba(236, 244, 236, 0.55)',
        ])
        map.setPaintProperty(CALM_CIRCLE_LAYER, 'circle-stroke-width', [
          'case',
          ['==', ['get', 'id'], calmFocusId ?? ''],
          2.2,
          1.1,
        ])
      }
      if (!map.getLayer(CALM_LABEL_LAYER)) {
        map.addLayer({
          id: CALM_LABEL_LAYER,
          type: 'symbol',
          source: CALM_SRC,
          layout: {
            visibility: calmMode ? 'visible' : 'none',
            'text-field': ['get', 'shortLabel'],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 11,
            'text-offset': [0, 1.35],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: {
            'text-color': '#d5e4da',
            'text-halo-color': 'rgba(12,22,26,0.88)',
            'text-halo-width': 1.2,
          },
        })
      } else {
        map.setLayoutProperty(
          CALM_LABEL_LAYER,
          'visibility',
          calmMode ? 'visible' : 'none',
        )
      }
    }

    ensure()
    map.on('style.load', ensure)
    return () => {
      cancelled = true
      map.off('style.load', ensure)
    }
  }, [mapReady, calmData, calmMode, calmFocusId])

  // Hong Kong raster + Seoul bubbles — unlock once, then keep visible
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return

    const showHk = Boolean(story?.overlays?.hongkong)
    const showSeoul = Boolean(story?.overlays?.seoul)
    let cancelled = false
    const asset = (path: string) => {
      const base = import.meta.env.BASE_URL || '/'
      const p = path.startsWith('/') ? path.slice(1) : path
      return `${base}${p}`
    }

    const setVis = (layerId: string, on: boolean) => {
      if (!map.getLayer(layerId)) return
      map.setLayoutProperty(layerId, 'visibility', on ? 'visible' : 'none')
    }

    const ensureHk = async () => {
      if (!showHk) {
        setVis(HK_IMAGE_LAYER, false)
        return
      }
      try {
        if (!map.getSource(HK_IMAGE_SRC)) {
          const meta = (await fetch(asset(HK_OVERLAY_META_URL)).then((r) => {
            if (!r.ok) throw new Error(`HK meta ${r.status}`)
            return r.json()
          })) as {
            url: string
            coordinates: [[number, number], [number, number], [number, number], [number, number]]
          }
          if (cancelled) return
          const url = asset(meta.url.startsWith('/') ? meta.url : `/${meta.url}`)
          map.addSource(HK_IMAGE_SRC, {
            type: 'image',
            url,
            coordinates: meta.coordinates,
          })
        }
        if (cancelled) return
        if (!map.getLayer(HK_IMAGE_LAYER)) {
          // On top of rings so the L10 surface is not buried
          map.addLayer({
            id: HK_IMAGE_LAYER,
            type: 'raster',
            source: HK_IMAGE_SRC,
            paint: { 'raster-opacity': 0.82, 'raster-fade-duration': 0 },
            layout: { visibility: 'visible' },
          })
        } else {
          setVis(HK_IMAGE_LAYER, true)
          map.setPaintProperty(HK_IMAGE_LAYER, 'raster-opacity', 0.82)
        }
      } catch (err) {
        console.warn('[NoiseMap] Hong Kong overlay failed', err)
      }
    }

    const clearSeoulMarkers = () => {
      for (const m of seoulMarkersRef.current) m.remove()
      seoulMarkersRef.current = []
    }

    const syncSeoulMarkers = (data: FeatureCollection<Point>) => {
      clearSeoulMarkers()
      if (cancelled || !showSeoul) return
      for (const f of data.features) {
        if (f.geometry?.type !== 'Point') continue
        const mean = Number(f.properties?.mean_db)
        const el = makeSeoulWaveElement(Number.isFinite(mean) ? mean : SEOUL_DB_MIN)
        const marker = new maplibregl.Marker({
          element: el,
          // Decorative only — MapLibre hit layer owns hover.
          className: 'seoul-wave-marker',
        })
          .setLngLat(f.geometry.coordinates as [number, number])
          .addTo(map)
        seoulMarkersRef.current.push(marker)
      }
    }

    const ensureSeoul = async () => {
      if (!showSeoul) {
        clearSeoulMarkers()
        setVis(SEOUL_HIT_LAYER, false)
        setVis(SEOUL_CENTER_LAYER, false)
        setVis(SEOUL_LABEL_LAYER, false)
        return
      }
      try {
        let data = seoulSitesDataRef.current
        if (!map.getSource(SEOUL_SRC)) {
          data = (await fetch(asset(SEOUL_SITES_URL)).then((r) => {
            if (!r.ok) throw new Error(`Seoul sites ${r.status}`)
            return r.json()
          })) as FeatureCollection<Point>
          if (cancelled) return
          seoulSitesDataRef.current = data
          map.addSource(SEOUL_SRC, { type: 'geojson', data })
        } else if (!data) {
          data = (await fetch(asset(SEOUL_SITES_URL)).then((r) => {
            if (!r.ok) throw new Error(`Seoul sites ${r.status}`)
            return r.json()
          })) as FeatureCollection<Point>
          if (cancelled) return
          seoulSitesDataRef.current = data
        }
        if (cancelled || !data) return

        // Soft cyan hit halo (query target) under the compact center dot.
        if (!map.getLayer(SEOUL_HIT_LAYER)) {
          map.addLayer({
            id: SEOUL_HIT_LAYER,
            type: 'circle',
            source: SEOUL_SRC,
            layout: { visibility: 'visible' },
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7,
                12,
                10,
                14,
                12,
                16,
              ],
              'circle-color': '#00b8cc',
              'circle-opacity': 0.16,
              'circle-stroke-width': 0,
            },
          })
        } else {
          setVis(SEOUL_HIT_LAYER, true)
        }

        if (!map.getLayer(SEOUL_CENTER_LAYER)) {
          map.addLayer({
            id: SEOUL_CENTER_LAYER,
            type: 'circle',
            source: SEOUL_SRC,
            layout: { visibility: 'visible' },
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7,
                4.5,
                10,
                5.5,
                12,
                6.5,
              ],
              'circle-color': '#00b8cc',
              'circle-opacity': 0.95,
              'circle-stroke-width': 0,
            },
          })
        } else {
          setVis(SEOUL_CENTER_LAYER, true)
        }

        if (!map.getLayer(SEOUL_LABEL_LAYER)) {
          map.addLayer({
            id: SEOUL_LABEL_LAYER,
            type: 'symbol',
            source: SEOUL_SRC,
            layout: {
              visibility: 'visible',
              'text-field': ['get', 'name_en'],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 12,
              'text-offset': [0, 1.35],
              'text-anchor': 'top',
              'text-optional': true,
            },
            paint: {
              'text-color': '#e8f0ff',
              'text-halo-color': 'rgba(3,5,10,0.9)',
              'text-halo-width': 1.2,
            },
          })
        } else {
          setVis(SEOUL_LABEL_LAYER, true)
        }

        syncSeoulMarkers(data)
      } catch (err) {
        console.warn('[NoiseMap] Seoul overlay failed', err)
      }
    }

    const run = () => {
      if (cancelled) return
      void ensureHk()
      void ensureSeoul()
    }

    // mapReady means our layers exist; do not gate on isStyleLoaded() —
    // it can flip false during easeTo and 'load' will not fire again.
    run()
    map.on('style.load', run)
    return () => {
      cancelled = true
      map.off('style.load', run)
      clearSeoulMarkers()
    }
  }, [mapReady, story?.overlays?.hongkong, story?.overlays?.seoul])

  type HkSample = {
    width: number
    height: number
    bbox: { west: number; east: number; north: number; south: number }
    data: Uint8Array
  }
  const hkSampleRef = useRef<HkSample | null>(null)
  const overlaysRef = useRef({ hongkong: false, seoul: false })
  overlaysRef.current = {
    hongkong: Boolean(story?.overlays?.hongkong),
    seoul: Boolean(story?.overlays?.seoul),
  }

  useEffect(() => {
    if (!story?.overlays?.hongkong || hkSampleRef.current) return
    let cancelled = false
    fetch(HK_SAMPLE_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HK sample ${r.status}`)
        return r.json()
      })
      .then((raw: {
        width: number
        height: number
        bbox: { west: number; east: number; north: number; south: number }
        data_b64: string
      }) => {
        if (cancelled) return
        const bin = atob(raw.data_b64)
        const data = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i)
        hkSampleRef.current = {
          width: raw.width,
          height: raw.height,
          bbox: raw.bbox,
          data,
        }
      })
      .catch(() => {
        /* optional */
      })
    return () => {
      cancelled = true
    }
  }, [story?.overlays?.hongkong])

  const countryAggs = useMemo(
    () => buildCountryAggregates(chartCities, source, metric),
    [chartCities, source, metric],
  )
  const countryAggsRef = useRef(countryAggs)
  countryAggsRef.current = countryAggs

  const pointsForToggle = useMemo(() => {
    const key = `${source}__${metric}`
    const features: Feature[] = []
    for (const c of chartCities) {
      if (c.lon == null || c.lat == null) continue
      const tip = c.series[key]
      if (!tip || !(tip.total > 0)) continue
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
        properties: {
          id: c.id,
          agglomeration: c.agglomeration,
          country: c.country,
          inhabitants: c.inhabitants,
          // Active tip only — avoid embedding every source×metric on each point
          tooltip: JSON.stringify(tip),
        } satisfies CityPointProps,
      })
    }
    return { type: 'FeatureCollection', features } satisfies FeatureCollection
  }, [chartCities, source, metric])

  useEffect(() => {
    let cancelled = false
    fetch(CHART_URL)
      .then((r) => r.json())
      .then((data: { cities: ChartCity[] }) => {
        if (!cancelled) setChartCities(hydrateChartCities(data.cities ?? []))
      })
      .catch(() => {
        if (!cancelled) setChartCities([])
      })
    fetch(STREAM_URL)
      .then((r) => r.json())
      .then((data: StreamData) => {
        if (!cancelled) setStreamData(data)
      })
      .catch(() => {
        if (!cancelled) setStreamData(null)
      })
    fetch(CALM_URL)
      .then((r) => r.json())
      .then((data: CalmSpacesData) => {
        if (!cancelled) setCalmData(data)
      })
      .catch(() => {
        if (!cancelled) setCalmData(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onStreamHoverCity = (id: string | null) => {
    if (!id) {
      // Keep pin highlight if pinned
      setMapHover(null, null)
      return
    }
    if (hoveredIdRef.current === id) {
      // Paint already correct; avoid redundant React churn while scrubbing stream
      applyFocusPaint(id ?? pinnedIdRef.current)
      return
    }
    const city = citiesRef.current.find((c) => c.id === id)
    if (!city) {
      setMapHover(id, null)
      return
    }
    const tip = city.series[`${sourceRef.current}__${metricRef.current}`]
    if (!tip) {
      setMapHover(id, {
        id,
        name: city.agglomeration,
        total: 0,
        points: [],
      })
      return
    }
    setMapHover(id, seriesFromBands(id, city.agglomeration, tip.bands))
  }

  /** ThemeRiver click → pin + same city drill zoom as map agglomeration click. */
  const onStreamSelectCity = (id: string) => {
    const map = mapRef.current
    const city = citiesRef.current.find((c) => c.id === id)
    if (!map || !city || city.lon == null || city.lat == null) return

    const tip = city.series[`${sourceRef.current}__${metricRef.current}`]
    const series = tip
      ? seriesFromBands(id, city.agglomeration, tip.bands)
      : ({
          id,
          name: city.agglomeration,
          total: 0,
          points: [],
        } satisfies HoverSeries)

    pinnedIdRef.current = id
    setPinnedId(id)
    setPinnedSeries(series)
    setMapHover(id, series)

    // Stream chart is Explore-only; still guard for safety.
    // Keep the selected city pinned (clearSelection: false).
    if (!exploreRef.current) return
    const lon = city.lon
    const lat = city.lat
    beginDrill(() => {
      easeDrillTo(map, [lon, lat], CITY_DRILL_ZOOM)
    }, { clearSelection: false })
  }

  const setCountryMode = (on: boolean) => {
    const map = mapRef.current
    if (!map) return
    countryModeRef.current = on
    const cityVis = on ? 'none' : 'visible'
    const countryVis = on ? 'visible' : 'none'
    if (map.getLayer(HIT_PAD_LAYER)) {
      map.setLayoutProperty(HIT_PAD_LAYER, 'visibility', cityVis)
    }
    if (map.getLayer(HIT_LAYER)) map.setLayoutProperty(HIT_LAYER, 'visibility', cityVis)
    if (map.getLayer(LABEL_LAYER)) map.setLayoutProperty(LABEL_LAYER, 'visibility', cityVis)
    if (map.getLayer(COUNTRY_HIT_PAD_LAYER)) {
      map.setLayoutProperty(COUNTRY_HIT_PAD_LAYER, 'visibility', countryVis)
    }
    if (map.getLayer(COUNTRY_HIT_LAYER)) {
      map.setLayoutProperty(COUNTRY_HIT_LAYER, 'visibility', countryVis)
    }
    if (map.getLayer(COUNTRY_LABEL_LAYER)) {
      map.setLayoutProperty(COUNTRY_LABEL_LAYER, 'visibility', countryVis)
    }
  }

  const rebuildRings = async () => {
    const map = mapRef.current
    if (!map || !map.getSource(CITIES_SOURCE) || !map.getSource(RINGS_SOURCE)) return
    const src = sourceRef.current
    const met = metricRef.current
    const citySource = map.getSource(CITIES_SOURCE) as maplibregl.GeoJSONSource

    // Far zoom: country rings. Past the threshold: city/cluster rings
    // (same band as manual zoom / click-drill — France → clusters → cities).
    const zoom = map.getZoom()
    const useCountryView = zoom < COUNTRY_VIEW_MAX_ZOOM
    // Only expand/build cities inside the zoomed viewport (not all of Europe).
    const viewBox = padMapBounds(map.getBounds())

    type CityUnit = {
      kind: 'city' | 'cluster'
      id: string
      lon: number
      lat: number
      label: string
      tips: ChartSeries[]
      cityCount: number
    }
    const cityUnits: CityUnit[] = []

    if (!useCountryView) {
      // Ensure city hit markers are queryable after leaving country overview.
      setCountryMode(false)

      // Clustered + unclustered points for the current zoom — filter to viewport
      // so getClusterLeaves stays cheap after country/cluster drill-in.
      const rendered = map.querySourceFeatures(CITIES_SOURCE)
      const seenClusters = new Set<number>()
      const seenCities = new Set<string>()

      for (const feat of rendered) {
        const props = feat.properties ?? {}
        const coords = (feat.geometry as Point | undefined)?.coordinates
        if (!coords || feat.geometry?.type !== 'Point') continue
        const lon = coords[0]
        const lat = coords[1]
        if (!inPadBounds(lon, lat, viewBox)) continue

        if (props.cluster) {
          const clusterId = Number(props.cluster_id)
          if (seenClusters.has(clusterId)) continue
          seenClusters.add(clusterId)
          let leaves: Feature[] = []
          try {
            leaves = await getClusterLeaves(citySource, clusterId)
          } catch {
            continue
          }
          const tips: ChartSeries[] = []
          for (const leaf of leaves) {
            const tip = tipFromProps(leaf.properties?.tooltip, src, met)
            if (tip) tips.push(tip)
          }
          if (!tips.length) continue
          cityUnits.push({
            kind: 'cluster',
            id: `cluster:${clusterId}`,
            lon,
            lat,
            label: `${leaves.length} cities`,
            tips,
            cityCount: leaves.length,
          })
        } else {
          const id = String(props.id ?? '')
          if (!id || seenCities.has(id)) continue
          seenCities.add(id)
          const tip = tipFromProps(props.tooltip, src, met)
          if (!tip) continue
          cityUnits.push({
            kind: 'city',
            id,
            lon,
            lat,
            label: String(props.agglomeration ?? id),
            tips: [tip],
            cityCount: 1,
          })
        }
      }
    }

    // After fitBounds/easeTo, cluster tiles can lag — retry instead of wiping rings.
    if (!useCountryView && cityUnits.length === 0) {
      setCountryMode(false)
      if (rebuildEmptyRetries.current < 24) {
        rebuildEmptyRetries.current += 1
        if (rebuildRetryTimer.current != null) {
          window.clearTimeout(rebuildRetryTimer.current)
        }
        rebuildRetryTimer.current = window.setTimeout(() => {
          rebuildRetryTimer.current = null
          void rebuildRings()
        }, 80)
        return
      }
    } else {
      rebuildEmptyRetries.current = 0
    }
    if (rebuildRetryTimer.current != null) {
      window.clearTimeout(rebuildRetryTimer.current)
      rebuildRetryTimer.current = null
    }

    const ringFeatures: Feature[] = []
    const cache = hoverCacheRef.current
    cache.clear()

    if (useCountryView) {
      setCountryMode(true)
      for (const agg of countryAggsRef.current) {
        if (!inPadBounds(agg.lon, agg.lat, viewBox)) continue
        if (!agg.bands.some((b) => b.people > 0)) continue
        const series = seriesFromBands(agg.id, agg.country, agg.bands)
        cache.set(agg.id, {
          id: agg.id,
          series,
          coords: [agg.lon, agg.lat],
          cityCount: agg.cityCount,
          title: agg.country,
        })
        ringFeatures.push(
          ...buildEqualSpacedRings({
            lon: agg.lon,
            lat: agg.lat,
            source: src,
            metric: met,
            bands: agg.bands,
            id: agg.id,
            label: agg.country,
            zoom,
          }),
        )
      }
    } else {
      setCountryMode(false)
      for (const unit of cityUnits) {
        const bands = aggregateBands(met, unit.tips)
        if (!bands.some((b) => b.people > 0)) continue
        const series = seriesFromBands(unit.id, unit.label, bands)
        cache.set(unit.id, {
          id: unit.id,
          series,
          coords: [unit.lon, unit.lat],
          cityCount: unit.cityCount,
          title: unit.label,
        })
        ringFeatures.push(
          ...buildEqualSpacedRings({
            lon: unit.lon,
            lat: unit.lat,
            source: src,
            metric: met,
            bands,
            id: unit.id,
            label: unit.label,
            zoom,
          }),
        )
      }
    }

    const ringSource = map.getSource(RINGS_SOURCE) as maplibregl.GeoJSONSource
    ringSource.setData({ type: 'FeatureCollection', features: ringFeatures })
    // Viewport cull for pulse filter (moveend/zoomend → rebuild)
    refreshPulseViewport()
    // Rings were replaced — force re-apply focus paint so dimming never sticks
    applyFocusPaint(focusIdRef.current, true)
  }

  const scheduleRebuild = () => {
    if (drillingRef.current) return
    if (rebuildTimer.current != null) window.clearTimeout(rebuildTimer.current)
    rebuildTimer.current = window.setTimeout(() => {
      void rebuildRings()
    }, 80)
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    ensureMaplibreWorker()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      bounds: EUROPE_BOUNDS,
      fitBoundsOptions: { padding: { top: 72, bottom: 48, left: 280, right: 48 } },
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right')

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: 'noise-tip',
      // BBH Hegarty display metrics differ from body — allow long Seoul one-liners.
      maxWidth: '420px',
    })
    popupRef.current = popup
    mapRef.current = map
    if (import.meta.env.DEV) {
      ;(window as unknown as { __noiseMap?: maplibregl.Map }).__noiseMap = map
    }

    map.on('load', () => {
      map.addSource(CITIES_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 70,
        clusterMaxZoom: CITY_CLUSTER_MAX_ZOOM,
      })

      map.addSource(RINGS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addSource(COUNTRIES_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Pulse UNDER static rings — idle opacity 0 until hover burst
      map.addLayer({
        id: RINGS_PULSE_LAYER,
        type: 'line',
        source: RINGS_SOURCE,
        filter: ['==', ['get', 'role'], 'pulse'],
        paint: {
          'line-color': PULSE_LINE_COLOR,
          'line-opacity': 0,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            1.6,
            5,
            2.1,
            7,
            2.6,
            10,
            3.2,
          ],
          'line-blur': PULSE_REST_BLUR,
        },
      })

      map.addLayer({
        id: RINGS_LAYER,
        type: 'line',
        source: RINGS_SOURCE,
        filter: ['==', ['get', 'role'], 'static'],
        paint: {
          'line-color': ['get', 'color'],
          'line-opacity': 0.88,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0.7,
            6,
            1.15,
            10,
            1.8,
          ],
          'line-blur': 0,
        },
      })

      map.addLayer({
        id: LABEL_LAYER,
        type: 'symbol',
        source: CITIES_SOURCE,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'agglomeration'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            0,
            6.5,
            11,
            9,
            13,
          ],
          'text-offset': [0, 1.15],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': '#c8d6ee',
          'text-halo-color': 'rgba(3,5,10,0.85)',
          'text-halo-width': 1.2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5.5,
            0,
            6.5,
            0.9,
          ],
        },
      })

      // Wide invisible pad under the small cyan center (hover/click target).
      // Outer ring arcs remain a hover fallback via RINGS_LAYER.
      map.addLayer({
        id: HIT_PAD_LAYER,
        type: 'circle',
        source: CITIES_SOURCE,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            16,
            7,
            20,
            11,
            24,
          ],
          'circle-color': '#00b8cc',
          // Near-invisible — still queryable; visual marker stays on HIT_LAYER.
          'circle-opacity': 0.001,
          'circle-stroke-width': 0,
        },
      })

      map.addLayer({
        id: HIT_LAYER,
        type: 'circle',
        source: CITIES_SOURCE,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            3,
            7,
            3.5,
            11,
            4.5,
          ],
          'circle-color': '#00b8cc',
          'circle-opacity': 0.92,
          'circle-stroke-width': 0,
        },
      })

      map.addLayer({
        id: COUNTRY_LABEL_LAYER,
        type: 'symbol',
        source: COUNTRIES_SOURCE,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'country'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2,
            11,
            5,
            14,
            7,
            16,
          ],
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': '#e8f0ff',
          'text-halo-color': 'rgba(3,5,10,0.9)',
          'text-halo-width': 1.4,
          'text-opacity': 0.95,
        },
      })

      map.addLayer({
        id: COUNTRY_HIT_PAD_LAYER,
        type: 'circle',
        source: COUNTRIES_SOURCE,
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2,
            18,
            5,
            22,
            7,
            26,
          ],
          'circle-color': '#00b8cc',
          'circle-opacity': 0.001,
          'circle-stroke-width': 0,
        },
      })

      map.addLayer({
        id: COUNTRY_HIT_LAYER,
        type: 'circle',
        source: COUNTRIES_SOURCE,
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2,
            3.5,
            5,
            4,
            7,
            5,
          ],
          'circle-color': '#00b8cc',
          'circle-opacity': 0.9,
          'circle-stroke-width': 0,
        },
      })

      // moveend/zoomend only — never idle (pulse paint would retrigger rebuild loops)
      map.on('moveend', scheduleRebuild)
      map.on('zoomend', scheduleRebuild)
      map.on('sourcedata', (e) => {
        if (e.sourceId === CITIES_SOURCE && e.isSourceLoaded) scheduleRebuild()
      })

      setMapReady(true)
      scheduleRebuild()
    })

    map.on('error', (e) => {
      console.warn('[NoiseMap]', e?.error ?? e)
    })

    // Explore: country/city/cluster click drills zoom (same thresholds as scroll).
    // Story: ignore city clicks (hover tips still work; cameras stay scrolly-owned).
    map.on('click', (e) => {
      if (!exploreRef.current) return

      const target = resolveNoiseTarget(map, e.point)
      if (!target) {
        pinnedIdRef.current = null
        focusIdRef.current = hoveredIdRef.current
        setPinnedId(null)
        setPinnedSeries(null)
        applyFocusPaint(hoveredIdRef.current)
        return
      }

      // Explore click-zoom: clear selection in beginDrill so next-level rings
      // are not dimmed by the previous country/cluster focus id.
      if (target.id.startsWith('country:')) {
        beginDrill(() => {
          fitCountryDrill(
            map,
            citiesRef.current,
            target.title,
            target.coords,
          )
        })
        return
      }

      if (target.id.startsWith('cluster:')) {
        const clusterId = Number(target.id.slice('cluster:'.length))
        if (!Number.isFinite(clusterId)) return
        const citySource = map.getSource(CITIES_SOURCE) as maplibregl.GeoJSONSource
        void citySource.getClusterExpansionZoom(clusterId).then((zoom) => {
          beginDrill(() => {
            map.easeTo({
              center: target.coords,
              zoom,
              duration: DRILL_DURATION_MS,
              essential: true,
            })
          })
        })
        return
      }

      beginDrill(() => {
        easeDrillTo(map, target.coords, CITY_DRILL_ZOOM)
      })
    })

    return () => {
      if (rebuildTimer.current != null) window.clearTimeout(rebuildTimer.current)
      if (rebuildRetryTimer.current != null) {
        window.clearTimeout(rebuildRetryTimer.current)
      }
      for (const m of seoulMarkersRef.current) m.remove()
      seoulMarkersRef.current = []
      popup.remove()
      map.remove()
      mapRef.current = null
      popupRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push filtered city points when data/toggle changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const src = map.getSource(CITIES_SOURCE) as maplibregl.GeoJSONSource | undefined
      const countries = map.getSource(COUNTRIES_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (!src) return
      src.setData(pointsForToggle)
      if (countries) countries.setData(countriesToGeoJSON(countryAggs))
      popupRef.current?.remove()
      cancelPendingClear()
      hoverGenRef.current += 1
      hoveredIdRef.current = null
      pinnedIdRef.current = null
      focusIdRef.current = null
      applyFocusPaint(null)
      setHoveredId(null)
      setHoverSeries(null)
      setPinnedId(null)
      setPinnedSeries(null)
      map.getCanvas().style.cursor = ''
      scheduleRebuild()
    }
    if (map.isStyleLoaded() && map.getSource(CITIES_SOURCE)) apply()
    else map.once('load', apply)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsForToggle, countryAggs, source, metric])

  // Story/pin focus from React only — map pointer owns hover paint via refs
  useEffect(() => {
    if (hoveredIdRef.current) return
    applyFocusPaint(focusId)
  }, [focusId])

  // Hover — rings→cache resolve; rAF-throttled; empty hits debounced; skip while drilling
  useEffect(() => {
    const map = mapRef.current
    const popup = popupRef.current
    if (!map || !popup) return

    const clearHoverNow = () => {
      cancelPendingClear()
      map.getCanvas().style.cursor = ''
      popup.remove()
      lastTipIdRef.current = null
      setMapHover(null, null)
    }

    const scheduleClearHover = () => {
      if (drillingRef.current) return
      if (clearHoverTimer.current != null) return
      clearHoverTimer.current = window.setTimeout(() => {
        clearHoverTimer.current = null
        if (drillingRef.current) return
        if (hoveredIdRef.current != null) clearHoverNow()
      }, HOVER_CLEAR_MS)
    }

    const sampleHkDb = (lng: number, lat: number): number | null => {
      const hkSample = hkSampleRef.current
      if (!hkSample) return null
      const { west, east, north, south } = hkSample.bbox
      if (lng < west || lng > east || lat < south || lat > north) return null
      const x = ((lng - west) / (east - west)) * (hkSample.width - 1)
      const y = ((north - lat) / (north - south)) * (hkSample.height - 1)
      const c = Math.round(x)
      const r = Math.round(y)
      if (c < 0 || r < 0 || c >= hkSample.width || r >= hkSample.height) return null
      const q = hkSample.data[r * hkSample.width + c]
      if (q === 255) return null
      return 30 + (q / 254) * 70
    }

    const handlePointer = (e: maplibregl.MapMouseEvent) => {
      if (drillingRef.current) return

      // Calm spaces bubbles (story beat or explore toggle)
      if (
        calmModeRef.current &&
        map.getLayer(CALM_CIRCLE_LAYER) &&
        map.getLayoutProperty(CALM_CIRCLE_LAYER, 'visibility') !== 'none'
      ) {
        const calmHits = map.queryRenderedFeatures(e.point, {
          layers: [CALM_CIRCLE_LAYER],
        })
        if (calmHits.length) {
          cancelPendingClear()
          const p = calmHits[0].properties ?? {}
          const id = String(p.id ?? '')
          map.getCanvas().style.cursor = 'pointer'
          setCalmFocusId(id || null)
          lastTipIdRef.current = `calm:${id}`
          const day =
            p.day_db != null && p.day_db !== ''
              ? Number(p.day_db)
              : null
          const night =
            p.night_db != null && p.night_db !== ''
              ? Number(p.night_db)
              : null
          const parts: string[] = []
          if (day != null && Number.isFinite(day)) {
            parts.push(`<span class="tip-calm-day">${day.toFixed(1)} dB day</span>`)
          }
          if (night != null && Number.isFinite(night)) {
            parts.push(
              `<span class="tip-calm-night">${night.toFixed(1)} dB night</span>`,
            )
          }
          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="tip tip--calm"><div class="tip-title">${String(p.shortLabel ?? p.label ?? '')}</div><div class="tip-sub">${parts.join(' · ') || String(p.metric ?? '')}</div></div>`,
            )
            .addTo(map)
          return
        }
        setCalmFocusId(null)
      }

      // City overlays take tooltip priority when unlocked
      if (
        overlaysRef.current.seoul &&
        map.getLayer(SEOUL_HIT_LAYER) &&
        map.getLayoutProperty(SEOUL_HIT_LAYER, 'visibility') !== 'none'
      ) {
        const seoulHits = map.queryRenderedFeatures(e.point, {
          layers: [SEOUL_HIT_LAYER, SEOUL_CENTER_LAYER],
        })
        if (seoulHits.length) {
          cancelPendingClear()
          const p = seoulHits[0].properties ?? {}
          map.getCanvas().style.cursor = 'pointer'
          lastTipIdRef.current = `seoul:${String(p.name_en ?? '')}`
          const coords = (seoulHits[0].geometry as Point | undefined)?.coordinates
          const tipLngLat =
            coords && coords.length >= 2
              ? (coords as [number, number])
              : e.lngLat
          popup
            .setLngLat(tipLngLat)
            .setHTML(
              `<div class="tip tip--seoul"><span class="tip-seoul-line"><span class="tip-seoul-name">${String(p.name_en ?? '')}</span><span class="tip-seoul-sep" aria-hidden="true">·</span><span class="tip-seoul-db">${Number(p.mean_db).toFixed(1)} dB noise</span></span></div>`,
            )
            .addTo(map)
          return
        }
      }
      if (
        overlaysRef.current.hongkong &&
        map.getLayer(HK_IMAGE_LAYER) &&
        map.getLayoutProperty(HK_IMAGE_LAYER, 'visibility') !== 'none'
      ) {
        const db = sampleHkDb(e.lngLat.lng, e.lngLat.lat)
        if (db != null) {
          cancelPendingClear()
          map.getCanvas().style.cursor = 'crosshair'
          lastTipIdRef.current = 'hk-sample'
          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="tip tip--hk"><span class="tip-hk-line">${db.toFixed(0)} dB</span></div>`,
            )
            .addTo(map)
          return
        }
      }

      const target = resolveNoiseTarget(map, e.point)
      if (!target) {
        scheduleClearHover()
        return
      }

      cancelPendingClear()
      // Story: default cursor on cities (not clickable). Explore: pointer.
      map.getCanvas().style.cursor = exploreRef.current ? 'pointer' : ''
      if (hoveredIdRef.current !== target.id) {
        setMapHover(target.id, target.series)
      }
      showNoisePopup(map, popup, target)
    }

    let pending: maplibregl.MapMouseEvent | null = null
    const onMove = (e: maplibregl.MapMouseEvent) => {
      pending = e
      if (hoverMoveRafRef.current) return
      hoverMoveRafRef.current = window.requestAnimationFrame(() => {
        hoverMoveRafRef.current = 0
        const ev = pending
        pending = null
        if (ev) handlePointer(ev)
      })
    }

    const canvas = map.getCanvas()
    const onCanvasLeave = () => {
      if (drillingRef.current) return
      // Prefer canvas mouseleave over map mouseout (avoids popup/control fights)
      clearHoverNow()
    }

    const bind = () => {
      map.on('mousemove', onMove)
      canvas.addEventListener('mouseleave', onCanvasLeave)
    }
    if (map.isStyleLoaded()) bind()
    else map.once('load', bind)

    return () => {
      cancelPendingClear()
      if (hoverMoveRafRef.current) {
        window.cancelAnimationFrame(hoverMoveRafRef.current)
        hoverMoveRafRef.current = 0
      }
      map.off('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onCanvasLeave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className={`noise-shell${calmMode ? ' noise-shell--calm' : ''}`}>
      <header className="noise-top">
        <motion.div
          className="noise-brand"
          aria-hidden={!explore}
          initial={false}
          animate={
            explore
              ? { opacity: 1, y: 0, pointerEvents: 'auto' as const }
              : { opacity: 0, y: -11, pointerEvents: 'none' as const }
          }
          transition={titleFade}
        >
          <h1>Do you hear the birds?</h1>
          <p className="noise-sub">The world might be too noisy to do that.</p>
        </motion.div>
        {explore ? (
          <div className="noise-controls" role="group" aria-label="Noise layer controls">
            <div className="seg" role="radiogroup" aria-label="Source">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={source === s.id ? 'active' : ''}
                  aria-pressed={source === s.id}
                  onClick={() => setSource(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div
              className="seg metric"
              role="radiogroup"
              aria-label="Noise period"
            >
              {METRICS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={metric === m.id ? 'active' : ''}
                  aria-pressed={metric === m.id}
                  onClick={() => setMetric(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="noise-mode-tag"
              aria-pressed={true}
              aria-label="Switch to story mode"
              onClick={() => setModeOverride('story')}
            >
              exploration mode
            </button>
            {story?.onAudioMutedChange ? (
              <AudioMuteToggle
                muted={Boolean(story.audioMuted)}
                onChange={story.onAudioMutedChange}
              />
            ) : null}
          </div>
        ) : (
          <div className="noise-controls noise-controls--story">
            <button
              type="button"
              className="noise-mode-tag noise-mode-tag--story"
              aria-pressed={false}
              aria-label="Switch to exploration mode"
              onClick={() => setModeOverride('explore')}
            >
              Story mode
            </button>
            {story?.onAudioMutedChange ? (
              <AudioMuteToggle
                muted={Boolean(story.audioMuted)}
                onChange={story.onAudioMutedChange}
              />
            ) : null}
          </div>
        )}
      </header>

      <div className="noise-canvas-wrap">
        <div className="noise-canvas" ref={containerRef} />
        {chartCities.length > 0 && tipAnchor && !calmMode ? (
          <CityWaveChart
            cities={chartCities}
            source={source}
            metric={metric}
            hoveredId={hoveredId}
            hoverSeries={hoverSeries}
            pinnedId={pinnedId}
            pinnedSeries={pinnedSeries}
            pinned={Boolean(pinnedId)}
            sidecar={tipAnchor}
          />
        ) : null}
        {calmData && calmMode ? (
          <CalmSpacesChart
            data={calmData}
            focusId={calmFocusId}
            onHoverPlace={(id) => setCalmFocusId(id)}
            active={Boolean(story?.calmScatterActive)}
            haltToken={story?.calmHaltToken ?? 0}
            preview={story?.calmPreview ?? null}
            onPreviewChange={story?.onCalmPreviewChange}
            muted={Boolean(story?.audioMuted)}
          />
        ) : null}
        {streamData && explore && !calmMode ? (
          <ThemeRiverChart
            data={streamData}
            source={source}
            focusId={focusId}
            onHoverCity={onStreamHoverCity}
            onSelectCity={onStreamSelectCity}
          />
        ) : null}
      </div>
    </section>
  )
}
