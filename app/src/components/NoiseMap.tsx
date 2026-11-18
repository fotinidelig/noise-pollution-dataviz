import { useEffect, useMemo, useRef, useState } from 'react'
import type { Feature, FeatureCollection, Point } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  EUROPE_BOUNDS,
  METRICS,
  SOURCES,
  type NoiseMetric,
  type NoiseSource,
} from '../lib/noiseStyle'
import {
  MAX_UNITS_PER_COUNTRY_FOR_COUNTRY_VIEW,
  buildCountryAggregates,
  countriesToGeoJSON,
  seriesFromBands,
  tipFromProps,
} from '../lib/countryAggregates'
import {
  aggregateBands,
  buildEqualSpacedRings,
  seriesToBands,
} from '../lib/ringGeometry'
import {
  CityWaveChart,
  type ChartCity,
  type ChartSeries,
  type HoverSeries,
} from './CityWaveChart'
import { ThemeRiverChart, type StreamData } from './ThemeRiverChart'
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
/** Phase advance per ~80ms tick — lower = slower crest. */
const PULSE_PHASE_STEP = 0.038
const HIT_LAYER = 'aggl-hit'
const LABEL_LAYER = 'aggl-labels'
const COUNTRY_HIT_LAYER = 'aggl-country-hit'
const COUNTRY_LABEL_LAYER = 'aggl-country-labels'
const CHART_URL = '/data/agglomeration_chart.json'
const STREAM_URL = '/data/agglomeration_ha_hsd_stream.json'
const HK_OVERLAY_META_URL = '/data/hong_kong_l10_overlay.json'
const HK_SAMPLE_URL = '/data/hong_kong_l10_sample.json'
const SEOUL_SITES_URL = '/data/seoul_road_sites.geojson'
const HK_IMAGE_SRC = 'hk-l10-image'
const HK_IMAGE_LAYER = 'hk-l10-layer'
const SEOUL_SRC = 'seoul-road-sites'
const SEOUL_CIRCLE_LAYER = 'seoul-road-circles'
const SEOUL_LABEL_LAYER = 'seoul-road-labels'

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
  if (mean != null) subParts.push(`<span class="tip-mean">~${mean} dB</span>`)
  subParts.push(citiesLabel)
  const rows = bands
    .filter((b) => b.people > 0)
    .map(
      (b) =>
        `<div class="tip-row"><span class="tip-swatch" style="background:${b.color}"></span><span>${b.label}</span><span class="tip-num">${formatPeople(b.people)}</span></div>`,
    )
    .join('')

  return `
    <div class="tip">
      <div class="tip-title">${title}</div>
      <div class="tip-sub">${subParts.join(' · ')}</div>
      <div class="tip-total">${formatPeople(total)} people in mapped bands</div>
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

export type StoryMapControl = {
  stepId: string
  center: [number, number]
  zoom: number
  source?: NoiseSource
  metric?: NoiseMetric
  highlightId?: string | null
  explore?: boolean
  /** Once unlocked in the story, keep city overlays visible. */
  overlays?: { hongkong?: boolean; seoul?: boolean }
}

type NoiseMapProps = {
  story?: StoryMapControl | null
}

export function NoiseMap({ story = null }: NoiseMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const citiesRef = useRef<ChartCity[]>([])
  const sourceRef = useRef<NoiseSource>('road')
  const metricRef = useRef<NoiseMetric>('Lden')
  const rebuildTimer = useRef<number | null>(null)
  const countryModeRef = useRef(false)
  const lastStoryStep = useRef<string | null>(null)
  const pulsePhaseRef = useRef(0)
  const pulseRafRef = useRef<number | null>(null)
  const ringFocusIdRef = useRef<string | null>(null)
  const paintRingSoundWaveRef = useRef<(activeId?: string | null) => void>(() => {})
  const pulseErrorLoggedRef = useRef(false)

  // Standalone map = explore; scrolly steps lock until the final explore beat
  const explore = !story || Boolean(story.explore)
  const storyLocked = Boolean(story) && !explore

  const [source, setSource] = useState<NoiseSource>('road')
  const [metric, setMetric] = useState<NoiseMetric>('Lden')
  const [status, setStatus] = useState('Loading map…')
  const [mapReady, setMapReady] = useState(false)
  const [chartCities, setChartCities] = useState<ChartCity[]>([])
  const [streamData, setStreamData] = useState<StreamData | null>(null)
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
  const hoveredIdRef = useRef<string | null>(null)
  const focusIdRef = useRef<string | null>(null)
  const hoverGenRef = useRef(0)
  const clearHoverTimer = useRef<number | null>(null)

  sourceRef.current = source
  metricRef.current = metric
  citiesRef.current = chartCities
  pinnedIdRef.current = pinnedId
  hoveredIdRef.current = hoveredId

  const focusId = hoveredId ?? pinnedId ?? (storyLocked ? story?.highlightId ?? null : null)
  focusIdRef.current = focusId

  /**
   * Paint-only pulse layer (twins of static rings + outer).
   * Throttled ~12fps; never touches hit layers or static ring paint used by hover.
   * Soft focus dim only — harsh 0.12 mul made the wave invisible in story/hover.
   */
  const paintRingSoundWave = (activeId: string | null = ringFocusIdRef.current) => {
    const map = mapRef.current
    if (!map || !map.getLayer(RINGS_PULSE_LAYER)) return
    ringFocusIdRef.current = activeId
    const dimming = Boolean(activeId)
    const id = activeId ?? ''
    const phase = pulsePhaseRef.current
    const N = RING_PULSE_BUCKETS

    const opacityStops: number[] = []
    const blurStops: number[] = []
    for (let i = 0; i < N; i++) {
      // Short period so crest travels through a typical city stack
      let t = i / RING_PULSE_PERIOD - phase
      t = t - Math.floor(t)
      const soft = Math.sin(t * Math.PI) ** 3
      // Tasteful crest: still readable, lower peak than the neon pass
      opacityStops.push(i, 0.12 + 0.58 * soft)
      blurStops.push(i, 0.1 + 0.9 * soft)
    }

    const ringIdx = [
      'coalesce',
      ['to-number', ['get', 'ring_index']],
      0,
    ] as maplibregl.ExpressionSpecification

    // Keep non-focus pulses readable (was 0.12 → invisible)
    const focusMul: maplibregl.ExpressionSpecification | number = dimming
      ? ([
          'case',
          ['==', ['to-string', ['get', 'id']], id],
          1,
          0.55,
        ] as maplibregl.ExpressionSpecification)
      : 1

    try {
      map.setPaintProperty(RINGS_PULSE_LAYER, 'line-opacity', [
        '*',
        focusMul,
        [
          'interpolate',
          ['linear'],
          ringIdx,
          ...opacityStops,
        ],
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
        console.warn('[rings pulse] paint failed', err)
      }
    }
  }
  paintRingSoundWaveRef.current = paintRingSoundWave

  /** Apply ring/label dimming immediately (do not wait for React paint effect). */
  const applyFocusPaint = (activeId: string | null) => {
    const map = mapRef.current
    if (!map || !map.getLayer(RINGS_LAYER)) return
    const dimming = Boolean(activeId)
    const id = activeId ?? ''
    ringFocusIdRef.current = activeId

    // Static rings only — pulse layer is updated by the rAF loop
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
    // Sync pulse focus mul without waiting for next rAF tick
    paintRingSoundWave(activeId)

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
  }

  const cancelPendingClear = () => {
    if (clearHoverTimer.current != null) {
      window.clearTimeout(clearHoverTimer.current)
      clearHoverTimer.current = null
    }
  }

  const setMapHover = (id: string | null, series: HoverSeries | null) => {
    cancelPendingClear()
    hoverGenRef.current += 1
    hoveredIdRef.current = id
    focusIdRef.current = id ?? pinnedIdRef.current
    applyFocusPaint(focusIdRef.current)
    setHoveredId(id)
    setHoverSeries(series)
  }

  // Sync story camera / layer locks (scrolly)
  useEffect(() => {
    if (!story) return
    if (story.source) setSource(story.source)
    if (story.metric) setMetric(story.metric)
    const map = mapRef.current
    if (!map) return
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
    story?.stepId,
    story?.center?.[0],
    story?.center?.[1],
    story?.zoom,
    story?.source,
    story?.metric,
    story?.highlightId,
    story?.explore,
  ])

  // Lock map chrome to story scroll until Explore
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const handlers = [
      map.scrollZoom,
      map.dragPan,
      map.touchZoomRotate,
      map.doubleClickZoom,
      map.boxZoom,
      map.keyboard,
      map.dragRotate,
    ] as const
    if (storyLocked) {
      for (const h of handlers) h.disable()
    } else {
      for (const h of handlers) h.enable()
    }
    const nav = document.querySelector('.maplibregl-ctrl-bottom-right') as HTMLElement | null
    if (nav) nav.style.display = storyLocked ? 'none' : ''
  }, [storyLocked, story?.stepId, mapReady])

  // Outer-ring pulse only (~12fps) — never rebuilds geometry, never paints static rings
  useEffect(() => {
    if (!mapReady) return
    let last = 0
    const tick = (now: number) => {
      if (now - last >= 80) {
        last = now
        pulsePhaseRef.current = (pulsePhaseRef.current + PULSE_PHASE_STEP) % 1
        paintRingSoundWaveRef.current(ringFocusIdRef.current)
      }
      pulseRafRef.current = window.requestAnimationFrame(tick)
    }
    paintRingSoundWaveRef.current(ringFocusIdRef.current)
    pulseRafRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (pulseRafRef.current != null) {
        window.cancelAnimationFrame(pulseRafRef.current)
        pulseRafRef.current = null
      }
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
        left: r.right - wrapBox.left + 8,
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

  // Hong Kong raster + Seoul bubbles — unlock once, then keep visible
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const showHk = Boolean(story?.overlays?.hongkong)
    const showSeoul = Boolean(story?.overlays?.seoul)

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
          const meta = (await fetch(HK_OVERLAY_META_URL).then((r) => r.json())) as {
            url: string
            coordinates: [[number, number], [number, number], [number, number], [number, number]]
          }
          map.addSource(HK_IMAGE_SRC, {
            type: 'image',
            url: meta.url,
            coordinates: meta.coordinates,
          })
        }
        if (!map.getLayer(HK_IMAGE_LAYER)) {
          map.addLayer(
            {
              id: HK_IMAGE_LAYER,
              type: 'raster',
              source: HK_IMAGE_SRC,
              paint: { 'raster-opacity': 0.78, 'raster-fade-duration': 0 },
              layout: { visibility: 'visible' },
            },
            RINGS_LAYER,
          )
        } else {
          setVis(HK_IMAGE_LAYER, true)
        }
      } catch {
        /* overlay optional */
      }
    }

    const ensureSeoul = async () => {
      if (!showSeoul) {
        setVis(SEOUL_CIRCLE_LAYER, false)
        setVis(SEOUL_LABEL_LAYER, false)
        return
      }
      try {
        if (!map.getSource(SEOUL_SRC)) {
          const data = await fetch(SEOUL_SITES_URL).then((r) => r.json())
          map.addSource(SEOUL_SRC, { type: 'geojson', data })
        }
        if (!map.getLayer(SEOUL_CIRCLE_LAYER)) {
          map.addLayer({
            id: SEOUL_CIRCLE_LAYER,
            type: 'circle',
            source: SEOUL_SRC,
            layout: { visibility: 'visible' },
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'mean_db'],
                64,
                10,
                70,
                18,
                74,
                28,
              ],
              'circle-color': '#ff6df5',
              'circle-opacity': 0.45,
              'circle-stroke-color': '#00e5ff',
              'circle-stroke-width': 1.4,
            },
          })
        } else {
          setVis(SEOUL_CIRCLE_LAYER, true)
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
              'text-offset': [0, 1.3],
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
      } catch {
        /* overlay optional */
      }
    }

    const run = () => {
      void ensureHk()
      void ensureSeoul()
    }

    if (map.isStyleLoaded()) run()
    else map.once('load', run)
  }, [story?.overlays?.hongkong, story?.overlays?.seoul])

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
      .then((r) => r.json())
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
          tooltip: JSON.stringify(c.series),
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
        if (!cancelled) setChartCities(data.cities ?? [])
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

  const setCountryMode = (on: boolean) => {
    const map = mapRef.current
    if (!map) return
    countryModeRef.current = on
    const cityVis = on ? 'none' : 'visible'
    const countryVis = on ? 'visible' : 'none'
    if (map.getLayer(HIT_LAYER)) map.setLayoutProperty(HIT_LAYER, 'visibility', cityVis)
    if (map.getLayer(LABEL_LAYER)) map.setLayoutProperty(LABEL_LAYER, 'visibility', cityVis)
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

    // Clustered + unclustered points for the current zoom
    const rendered = map.querySourceFeatures(CITIES_SOURCE)
    const unitsByCountry = new Map<string, number>()
    const seenClusters = new Set<number>()
    const seenCities = new Set<string>()
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

    for (const feat of rendered) {
      const props = feat.properties ?? {}
      const coords = (feat.geometry as Point | undefined)?.coordinates
      if (!coords || feat.geometry?.type !== 'Point') continue

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
        const countries = new Set<string>()
        for (const leaf of leaves) {
          const tip = tipFromProps(leaf.properties?.tooltip, src, met)
          if (tip) tips.push(tip)
          const c = String(leaf.properties?.country ?? '')
          if (c) countries.add(c)
        }
        if (!tips.length) continue
        for (const c of countries) {
          unitsByCountry.set(c, (unitsByCountry.get(c) ?? 0) + 1)
        }
        cityUnits.push({
          kind: 'cluster',
          id: `cluster:${clusterId}`,
          lon: coords[0],
          lat: coords[1],
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
        const country = String(props.country ?? '')
        if (country) unitsByCountry.set(country, (unitsByCountry.get(country) ?? 0) + 1)
        cityUnits.push({
          kind: 'city',
          id,
          lon: coords[0],
          lat: coords[1],
          label: String(props.agglomeration ?? id),
          tips: [tip],
          cityCount: 1,
        })
      }
    }

    // Landing / far zoom: always countries. Otherwise only when each country
    // has ≤2 city/cluster units on screen.
    const zoom = map.getZoom()
    const sparseEnough =
      unitsByCountry.size > 0 &&
      [...unitsByCountry.values()].every(
        (n) => n <= MAX_UNITS_PER_COUNTRY_FOR_COUNTRY_VIEW,
      )
    const useCountryView = zoom < 5 || sparseEnough

    const ringFeatures: Feature[] = []

    if (useCountryView) {
      setCountryMode(true)
      for (const agg of countryAggsRef.current) {
        if (!agg.bands.some((b) => b.people > 0)) continue
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
      setStatus(`${src} · ${met} · countries`)
    } else {
      setCountryMode(false)
      for (const unit of cityUnits) {
        const bands = aggregateBands(met, unit.tips)
        if (!bands.some((b) => b.people > 0)) continue
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
      setStatus(`${src} · ${met} · agglomerations`)
    }

    const ringSource = map.getSource(RINGS_SOURCE) as maplibregl.GeoJSONSource
    ringSource.setData({ type: 'FeatureCollection', features: ringFeatures })
    // Rings were replaced — re-apply focus paint so dimming never sticks/lags
    applyFocusPaint(focusIdRef.current)
  }

  const scheduleRebuild = () => {
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
      maxWidth: '280px',
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
        clusterMaxZoom: 8,
      })

      map.addSource(RINGS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addSource(COUNTRIES_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Pulse UNDER static rings so the coloured stack stays on top
      map.addLayer({
        id: RINGS_PULSE_LAYER,
        type: 'line',
        source: RINGS_SOURCE,
        filter: ['==', ['get', 'role'], 'pulse'],
        paint: {
          'line-color': PULSE_LINE_COLOR,
          'line-opacity': 0.4,
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
          'line-blur': 0.35,
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

      // Invisible hit targets only (no cyan dots)
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
            16,
            7,
            22,
            11,
            30,
          ],
          'circle-opacity': 0,
          'circle-stroke-width': 0,
          'circle-color': '#000000',
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
            22,
            5,
            28,
            7,
            34,
          ],
          'circle-opacity': 0,
          'circle-stroke-width': 0,
          'circle-color': '#000000',
        },
      })

      map.on('moveend', scheduleRebuild)
      map.on('zoomend', scheduleRebuild)
      map.on('sourcedata', (e) => {
        if (e.sourceId === CITIES_SOURCE && e.isSourceLoaded) scheduleRebuild()
      })

      setStatus(`${sourceRef.current} · ${metricRef.current} · countries`)
      setMapReady(true)
      scheduleRebuild()
    })

    map.on('error', () => {
      setStatus('Map error — check console / data assets')
    })

    // Country / city pin; cluster → zoom; empty → unpin
    map.on('click', (e) => {
      const hitLayers = countryModeRef.current
        ? [COUNTRY_HIT_LAYER]
        : [HIT_LAYER]
      const hits = map.queryRenderedFeatures(e.point, { layers: hitLayers })
      if (!hits.length) {
        pinnedIdRef.current = null
        setPinnedId(null)
        setPinnedSeries(null)
        applyFocusPaint(hoveredIdRef.current)
        return
      }
      const feat = hits[0]
      const props = feat.properties ?? {}

      if (props.kind === 'country') {
        const id = String(props.id ?? '')
        if (!id) return
        if (pinnedIdRef.current === id) {
          pinnedIdRef.current = null
          setPinnedId(null)
          setPinnedSeries(null)
          applyFocusPaint(hoveredIdRef.current)
          return
        }
        let series: HoverSeries | null = null
        try {
          series = JSON.parse(String(props.series || 'null')) as HoverSeries
        } catch {
          series = null
        }
        if (!series) return
        pinnedIdRef.current = id
        setPinnedId(id)
        setPinnedSeries(series)
        setMapHover(id, series)
        return
      }

      if (props.cluster) {
        const clusterId = Number(props.cluster_id)
        const citySource = map.getSource(CITIES_SOURCE) as maplibregl.GeoJSONSource
        void citySource.getClusterExpansionZoom(clusterId).then((zoom) => {
          const coords = (feat.geometry as Point).coordinates as [number, number]
          map.easeTo({ center: coords, zoom })
        })
        return
      }

      const id = String(props.id ?? '')
      if (!id) return
      if (pinnedIdRef.current === id) {
        pinnedIdRef.current = null
        setPinnedId(null)
        setPinnedSeries(null)
        applyFocusPaint(hoveredIdRef.current)
        return
      }

      const src = sourceRef.current
      const met = metricRef.current
      const tip = tipFromProps(props.tooltip, src, met)
      if (!tip) return
      const bands = seriesToBands(met, tip)
      const series = seriesFromBands(id, String(props.agglomeration ?? ''), bands)
      pinnedIdRef.current = id
      setPinnedId(id)
      setPinnedSeries(series)
      setMapHover(id, series)
    })

    return () => {
      if (rebuildTimer.current != null) window.clearTimeout(rebuildTimer.current)
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
      setStatus(`${source} · ${metric}`)
      scheduleRebuild()
    }
    if (map.isStyleLoaded() && map.getSource(CITIES_SOURCE)) apply()
    else map.once('load', apply)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsForToggle, countryAggs, source, metric])

  // Safety net: keep paint aligned if React focus changes without map handler
  useEffect(() => {
    applyFocusPaint(focusId)
  }, [focusId])

  // Hover — paint updates are synchronous via setMapHover; empty hits are debounced
  useEffect(() => {
    const map = mapRef.current
    const popup = popupRef.current
    if (!map || !popup) return

    const clearHoverNow = () => {
      cancelPendingClear()
      map.getCanvas().style.cursor = ''
      popup.remove()
      setMapHover(null, null)
    }

    const scheduleClearHover = () => {
      if (clearHoverTimer.current != null) return
      clearHoverTimer.current = window.setTimeout(() => {
        clearHoverTimer.current = null
        // Only clear if we still have no pending newer hover
        if (hoveredIdRef.current != null) clearHoverNow()
      }, 50)
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

    const onMove = async (e: maplibregl.MapMouseEvent) => {
      // City overlays take tooltip priority when unlocked
      if (
        overlaysRef.current.seoul &&
        map.getLayer(SEOUL_CIRCLE_LAYER) &&
        map.getLayoutProperty(SEOUL_CIRCLE_LAYER, 'visibility') !== 'none'
      ) {
        const seoulHits = map.queryRenderedFeatures(e.point, {
          layers: [SEOUL_CIRCLE_LAYER],
        })
        if (seoulHits.length) {
          cancelPendingClear()
          const p = seoulHits[0].properties ?? {}
          map.getCanvas().style.cursor = 'pointer'
          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="tip-name">${String(p.name_en ?? '')}</div><div class="tip-total">${Number(p.mean_db).toFixed(1)} dB mean</div>`,
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
          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="tip-name">Peak traffic noise</div><div class="tip-total">${db.toFixed(0)} dB</div>`,
            )
            .addTo(map)
          return
        }
      }

      const hitLayers = countryModeRef.current
        ? [COUNTRY_HIT_LAYER]
        : [HIT_LAYER]
      const feats = map.queryRenderedFeatures(e.point, { layers: hitLayers })
      if (!feats.length) {
        // Gaps between hit circles — debounce clear to avoid flicker / stuck dim
        scheduleClearHover()
        return
      }
      cancelPendingClear()

      const feat = feats[0]
      const props = feat.properties ?? {}
      const src = sourceRef.current
      const met = metricRef.current
      const coords = (feat.geometry as Point).coordinates as [number, number]
      map.getCanvas().style.cursor = 'pointer'

      if (props.kind === 'country') {
        let series: HoverSeries | null = null
        try {
          series = JSON.parse(String(props.series || 'null')) as HoverSeries
        } catch {
          series = null
        }
        if (!series) {
          scheduleClearHover()
          return
        }
        if (hoveredIdRef.current !== series.id) {
          setMapHover(series.id, series)
        } else {
          applyFocusPaint(series.id)
        }
        popup
          .setLngLat(coords)
          .setHTML(
            buildTooltipHtml(
              series.name,
              Number(props.cityCount ?? 0) || 0,
              met,
              series.points.map((b) => ({ ...b, rings: 0 })),
            ),
          )
          .addTo(map)
        return
      }

      if (props.cluster) {
        const clusterId = Number(props.cluster_id)
        const hoverId = `cluster:${clusterId}`
        // Optimistic paint before async leaves resolve
        if (hoveredIdRef.current !== hoverId) {
          applyFocusPaint(hoverId)
          hoveredIdRef.current = hoverId
          focusIdRef.current = hoverId
        }
        const gen = ++hoverGenRef.current
        const citySource = map.getSource(CITIES_SOURCE) as maplibregl.GeoJSONSource
        let leaves: Feature[] = []
        try {
          leaves = await getClusterLeaves(citySource, clusterId)
        } catch {
          if (gen === hoverGenRef.current) scheduleClearHover()
          return
        }
        if (gen !== hoverGenRef.current) return
        const tips: ChartSeries[] = []
        for (const leaf of leaves) {
          const tip = tipFromProps(leaf.properties?.tooltip, src, met)
          if (tip) tips.push(tip)
        }
        const bands = aggregateBands(met, tips)
        const series = seriesFromBands(
          hoverId,
          `${leaves.length} cities`,
          bands,
        )
        setMapHover(series.id, series)
        popup
          .setLngLat(coords)
          .setHTML(
            buildTooltipHtml(
              series.name,
              leaves.length,
              met,
              bands.map((b) => ({ ...b, rings: 0 })),
            ),
          )
          .addTo(map)
        return
      }

      const id = String(props.id ?? '')
      const tip = tipFromProps(props.tooltip, src, met)
      if (!tip) {
        scheduleClearHover()
        return
      }
      const bands = seriesToBands(met, tip)
      const series = seriesFromBands(id, String(props.agglomeration ?? ''), bands)
      if (hoveredIdRef.current !== id) {
        setMapHover(id, series)
      } else {
        applyFocusPaint(id)
      }
      popup
        .setLngLat(coords)
        .setHTML(
          buildTooltipHtml(
            String(props.agglomeration ?? ''),
            1,
            met,
            bands.map((b) => ({ ...b, rings: 0 })),
          ),
        )
        .addTo(map)
    }

    const canvas = map.getCanvas()
    const onCanvasLeave = () => {
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
      map.off('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onCanvasLeave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="noise-shell">
      <header className="noise-top">
        <div className="noise-brand">
          <p className="noise-eyebrow">EEA END 2022</p>
          <h1>Europe environmental noise</h1>
        </div>
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
            <div className="seg metric" role="radiogroup" aria-label="Metric">
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
          </div>
        ) : (
          <div className="noise-controls noise-controls--story">
            <span className="seg active-readonly">Story mode</span>
          </div>
        )}
      </header>

      <div className="noise-canvas-wrap">
        <div className="noise-canvas" ref={containerRef} />
        {chartCities.length > 0 && tipAnchor ? (
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
        {streamData && explore ? (
          <ThemeRiverChart
            data={streamData}
            source={source}
            focusId={focusId}
            onHoverCity={onStreamHoverCity}
          />
        ) : null}
        <p className="noise-status">{status}</p>
      </div>
    </section>
  )
}
