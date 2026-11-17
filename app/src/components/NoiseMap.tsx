import { useEffect, useMemo, useRef, useState } from 'react'
import type { Feature, FeatureCollection, Point } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  EUROPE_BOUNDS,
  LDEN_BANDS,
  LNIGHT_BANDS,
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
  PEOPLE_PER_RING,
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
const RINGS_LAYER = 'aggl-rings'
const HIT_LAYER = 'aggl-hit'
const LABEL_LAYER = 'aggl-labels'
const COUNTRY_HIT_LAYER = 'aggl-country-hit'
const COUNTRY_LABEL_LAYER = 'aggl-country-labels'
const CHART_URL = '/data/agglomeration_chart.json'
const STREAM_URL = '/data/agglomeration_ha_hsd_stream.json'

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
  subtitle: string,
  source: NoiseSource,
  metric: NoiseMetric,
  bands: { band: string; label: string; color: string; people: number }[],
) {
  const total = bands.reduce((s, b) => s + b.people, 0)
  const mean = meanDb(metric, bands)
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
      <div class="tip-sub">${subtitle}</div>
      <div class="tip-meta">${source} · ${metric}${mean != null ? ` · ~${mean} dB mean` : ''}</div>
      <div class="tip-total">${formatPeople(total)} people in mapped bands</div>
      <div class="tip-bands">${rows || '<div class="tip-empty">No exposure reported</div>'}</div>
      <div class="tip-note">1 ring ≈ ${formatPeople(PEOPLE_PER_RING)} people (max 12 / band) · equal ring spacing</div>
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

export function NoiseMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const citiesRef = useRef<ChartCity[]>([])
  const sourceRef = useRef<NoiseSource>('road')
  const metricRef = useRef<NoiseMetric>('Lden')
  const rebuildTimer = useRef<number | null>(null)
  const countryModeRef = useRef(false)

  const [source, setSource] = useState<NoiseSource>('road')
  const [metric, setMetric] = useState<NoiseMetric>('Lden')
  const [status, setStatus] = useState('Loading map…')
  const [chartCities, setChartCities] = useState<ChartCity[]>([])
  const [streamData, setStreamData] = useState<StreamData | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoverSeries, setHoverSeries] = useState<HoverSeries | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [pinnedSeries, setPinnedSeries] = useState<HoverSeries | null>(null)
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

  const focusId = hoveredId ?? pinnedId
  focusIdRef.current = focusId

  /** Apply ring/label dimming immediately (do not wait for React paint effect). */
  const applyFocusPaint = (activeId: string | null) => {
    const map = mapRef.current
    if (!map || !map.getLayer(RINGS_LAYER)) return
    const dimming = Boolean(activeId)
    const id = activeId ?? ''

    map.setPaintProperty(
      RINGS_LAYER,
      'line-opacity',
      dimming
        ? ([
            'case',
            ['==', ['to-string', ['get', 'id']], id],
            1,
            0.16,
          ] as maplibregl.ExpressionSpecification)
        : 0.9,
    )

    map.setPaintProperty(
      RINGS_LAYER,
      'line-width',
      dimming
        ? ([
            'case',
            ['==', ['to-string', ['get', 'id']], id],
            ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2.0, 10, 2.8],
            ['interpolate', ['linear'], ['zoom'], 3, 0.45, 6, 0.7, 10, 1.0],
          ] as maplibregl.ExpressionSpecification)
        : ([
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0.7,
            6,
            1.2,
            10,
            1.9,
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

      map.addLayer({
        id: RINGS_LAYER,
        type: 'line',
        source: RINGS_SOURCE,
        paint: {
          'line-color': ['get', 'color'],
          'line-opacity': 0.9,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0.7,
            6,
            1.2,
            10,
            1.9,
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

    const onMove = async (e: maplibregl.MapMouseEvent) => {
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
              `${props.cityCount ?? '?'} agglomerations · country total`,
              src,
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
              'aggregated · click to zoom in',
              src,
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
            `${props.country ?? ''} · ${formatPeople(Number(props.inhabitants ?? 0))} inhab.`,
            src,
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

  const bands = metric === 'Lden' ? LDEN_BANDS : LNIGHT_BANDS

  return (
    <section className="noise-shell">
      <header className="noise-top">
        <div className="noise-brand">
          <p className="noise-eyebrow">EEA END 2022</p>
          <h1>Europe environmental noise</h1>
        </div>
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
      </header>

      <div className="noise-canvas-wrap">
        <div className="noise-canvas" ref={containerRef} />
        {chartCities.length > 0 ? (
          <CityWaveChart
            cities={chartCities}
            source={source}
            metric={metric}
            hoveredId={hoveredId}
            hoverSeries={hoverSeries}
            pinnedId={pinnedId}
            pinnedSeries={pinnedSeries}
            pinned={Boolean(pinnedId)}
          />
        ) : null}
        {streamData ? (
          <ThemeRiverChart
            data={streamData}
            source={source}
            focusId={focusId}
            onHoverCity={onStreamHoverCity}
          />
        ) : null}
        <div className="noise-legend" aria-label="dB band legend">
          {bands.map((b) => (
            <div key={b.category} className="noise-legend__row">
              <span className="swatch" style={{ background: b.color }} />
              <span>{b.label}</span>
            </div>
          ))}
          <p className="noise-legend__note">
            1 ring = 10k people exposed to these dBs
          </p>
          <p className="noise-legend__note">Outer rings = louder</p>
        </div>
        <p className="noise-status">{status}</p>
      </div>
    </section>
  )
}
