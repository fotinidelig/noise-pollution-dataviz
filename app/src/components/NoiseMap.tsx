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
import './NoiseMap.css'

const CITIES_SOURCE = 'aggl-cities'
const RINGS_SOURCE = 'aggl-rings-dyn'
const RINGS_LAYER = 'aggl-rings'
const HIT_LAYER = 'aggl-hit'
const LABEL_LAYER = 'aggl-labels'
const CHART_URL = '/data/agglomeration_chart.json'

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

  const [source, setSource] = useState<NoiseSource>('road')
  const [metric, setMetric] = useState<NoiseMetric>('Lden')
  const [status, setStatus] = useState('Loading map…')
  const [chartCities, setChartCities] = useState<ChartCity[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoverSeries, setHoverSeries] = useState<HoverSeries | null>(null)

  sourceRef.current = source
  metricRef.current = metric
  citiesRef.current = chartCities

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
    return () => {
      cancelled = true
    }
  }, [])

  const rebuildRings = async () => {
    const map = mapRef.current
    if (!map || !map.getSource(CITIES_SOURCE) || !map.getSource(RINGS_SOURCE)) return
    const src = sourceRef.current
    const met = metricRef.current
    const key = `${src}__${met}`
    const citySource = map.getSource(CITIES_SOURCE) as maplibregl.GeoJSONSource

    // Clustered + unclustered points for the current zoom
    const rendered = map.querySourceFeatures(CITIES_SOURCE)
    const ringFeatures: Feature[] = []
    const seenClusters = new Set<number>()
    const seenCities = new Set<string>()

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
        for (const leaf of leaves) {
          try {
            const all = JSON.parse(String(leaf.properties?.tooltip || '{}')) as Record<
              string,
              ChartSeries
            >
            const tip = all[key]
            if (tip && tip.total > 0) tips.push(tip)
          } catch {
            /* skip */
          }
        }
        if (!tips.length) continue
        const bands = aggregateBands(met, tips)
        const label = `${leaves.length} cities`
        ringFeatures.push(
          ...buildEqualSpacedRings({
            lon: coords[0],
            lat: coords[1],
            source: src,
            metric: met,
            bands,
            id: `cluster:${clusterId}`,
            label,
          }),
        )
      } else {
        const id = String(props.id ?? '')
        if (!id || seenCities.has(id)) continue
        seenCities.add(id)
        let tip: ChartSeries | null = null
        try {
          const all = JSON.parse(String(props.tooltip || '{}')) as Record<string, ChartSeries>
          tip = all[key] ?? null
        } catch {
          tip = null
        }
        const bands = seriesToBands(met, tip)
        if (!bands.some((b) => b.people > 0)) continue
        ringFeatures.push(
          ...buildEqualSpacedRings({
            lon: coords[0],
            lat: coords[1],
            source: src,
            metric: met,
            bands,
            id,
            label: String(props.agglomeration ?? id),
          }),
        )
      }
    }

    const ringSource = map.getSource(RINGS_SOURCE) as maplibregl.GeoJSONSource
    ringSource.setData({ type: 'FeatureCollection', features: ringFeatures })
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
        clusterRadius: 56,
        clusterMaxZoom: 9,
      })

      map.addSource(RINGS_SOURCE, {
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

      map.on('moveend', scheduleRebuild)
      map.on('zoomend', scheduleRebuild)
      map.on('sourcedata', (e) => {
        if (e.sourceId === CITIES_SOURCE && e.isSourceLoaded) scheduleRebuild()
      })

      setStatus(`${sourceRef.current} · ${metricRef.current} · agglomerations`)
      scheduleRebuild()
    })

    map.on('error', () => {
      setStatus('Map error — check console / data assets')
    })

    // Click cluster → zoom to expand
    map.on('click', HIT_LAYER, (e) => {
      const feat = e.features?.[0]
      if (!feat?.properties?.cluster) return
      const clusterId = Number(feat.properties.cluster_id)
      const citySource = map.getSource(CITIES_SOURCE) as maplibregl.GeoJSONSource
      void citySource.getClusterExpansionZoom(clusterId).then((zoom) => {
        const coords = (feat.geometry as Point).coordinates as [number, number]
        map.easeTo({ center: coords, zoom })
      })
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
      if (!src) return
      src.setData(pointsForToggle)
      popupRef.current?.remove()
      setHoveredId(null)
      setHoverSeries(null)
      map.getCanvas().style.cursor = ''
      setStatus(`${source} · ${metric} · agglomerations`)
      scheduleRebuild()
    }
    if (map.isStyleLoaded() && map.getSource(CITIES_SOURCE)) apply()
    else map.once('load', apply)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsForToggle, source, metric])

  // Hover
  useEffect(() => {
    const map = mapRef.current
    const popup = popupRef.current
    if (!map || !popup) return

    const clearHover = () => {
      map.getCanvas().style.cursor = ''
      popup.remove()
      setHoveredId(null)
      setHoverSeries(null)
    }

    const onMove = async (e: maplibregl.MapMouseEvent) => {
      if (!map.getLayer(HIT_LAYER)) return
      const feats = map.queryRenderedFeatures(e.point, { layers: [HIT_LAYER] })
      if (!feats.length) {
        clearHover()
        return
      }
      const feat = feats[0]
      const props = feat.properties ?? {}
      const src = sourceRef.current
      const met = metricRef.current
      const key = `${src}__${met}`
      const coords = (feat.geometry as Point).coordinates as [number, number]
      map.getCanvas().style.cursor = 'pointer'

      if (props.cluster) {
        const clusterId = Number(props.cluster_id)
        const citySource = map.getSource(CITIES_SOURCE) as maplibregl.GeoJSONSource
        let leaves: Feature[] = []
        try {
          leaves = await getClusterLeaves(citySource, clusterId)
        } catch {
          clearHover()
          return
        }
        const tips: ChartSeries[] = []
        for (const leaf of leaves) {
          try {
            const all = JSON.parse(String(leaf.properties?.tooltip || '{}')) as Record<
              string,
              ChartSeries
            >
            const tip = all[key]
            if (tip && tip.total > 0) tips.push(tip)
          } catch {
            /* skip */
          }
        }
        const bands = aggregateBands(met, tips)
        const total = bands.reduce((s, b) => s + b.people, 0)
        const id = `cluster:${clusterId}`
        const name = `${leaves.length} cities`
        setHoveredId(id)
        setHoverSeries({
          id,
          name,
          total,
          points: bands.map((b) => ({
            band: b.band,
            label: b.label,
            color: b.color,
            people: b.people,
          })),
        })
        popup
          .setLngLat(coords)
          .setHTML(
            buildTooltipHtml(
              name,
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
      let tip: ChartSeries | null = null
      try {
        const all = JSON.parse(String(props.tooltip || '{}')) as Record<string, ChartSeries>
        tip = all[key] ?? null
      } catch {
        tip = null
      }
      if (!tip || !(tip.total > 0)) {
        clearHover()
        return
      }
      const bands = seriesToBands(met, tip)
      setHoveredId(id)
      setHoverSeries({
        id,
        name: String(props.agglomeration ?? ''),
        total: tip.total,
        points: bands.map((b) => ({
          band: b.band,
          label: b.label,
          color: b.color,
          people: b.people,
        })),
      })
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

    const bind = () => {
      map.on('mousemove', onMove)
      map.on('mouseout', clearHover)
    }
    if (map.isStyleLoaded() && map.getLayer(HIT_LAYER)) bind()
    else map.once('load', bind)

    return () => {
      map.off('mousemove', onMove)
      map.off('mouseout', clearHover)
    }
  }, [])

  const bands = metric === 'Lden' ? LDEN_BANDS : LNIGHT_BANDS

  return (
    <section className="noise-shell">
      <header className="noise-top">
        <div className="noise-brand">
          <p className="noise-eyebrow">EEA END 2022</p>
          <h1>Europe environmental noise</h1>
          <p className="noise-sub">
            Agglomerations · 1 ring ≈ 10k people · equal ring spacing · clusters when zoomed out
          </p>
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
            onHoverCity={setHoveredId}
          />
        ) : null}
        <div className="noise-legend" aria-label="dB band legend">
          {bands.map((b) => (
            <div key={b.category} className="noise-legend__row">
              <span className="swatch" style={{ background: b.color }} />
              <span>{b.label}</span>
            </div>
          ))}
          <p className="noise-legend__note">Outer rings = louder</p>
        </div>
        <p className="noise-status">{status}</p>
      </div>
    </section>
  )
}
