import { useEffect, useRef, useState } from 'react'
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
import './NoiseMap.css'

const RINGS_SOURCE = 'aggl-soundwaves'
const RINGS_LAYER = 'aggl-rings'
const HIT_LAYER = 'aggl-hit'
const LABEL_LAYER = 'aggl-labels'
const DATA_URL = '/data/agglomeration_soundwaves.geojson'
const PEOPLE_PER_RING = 10_000

let workerConfigured = false

function ensureMaplibreWorker() {
  if (workerConfigured) return
  maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}maplibre-gl-worker.mjs`)
  workerConfigured = true
}

type BandTip = {
  band: string
  label: string
  color: string
  people: number
  rings: number
}

type TipPayload = {
  mean_db: number | null
  total: number
  bands: BandTip[]
}

function formatPeople(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

function buildTooltipHtml(
  name: string,
  country: string,
  inhabitants: number,
  source: NoiseSource,
  metric: NoiseMetric,
  tip: TipPayload | null,
): string {
  const rows =
    tip?.bands
      .filter((b) => b.people > 0)
      .map(
        (b) =>
          `<div class="tip-row"><span class="tip-swatch" style="background:${b.color}"></span><span>${b.label}</span><span class="tip-num">${formatPeople(b.people)}</span></div>`,
      )
      .join('') ?? `<div class="tip-empty">No exposure reported</div>`

  const mean =
    tip?.mean_db != null ? `~${tip.mean_db} dB mean` : 'mean n/a'
  const total = tip ? formatPeople(tip.total) : '0'

  return `
    <div class="tip">
      <div class="tip-title">${name}</div>
      <div class="tip-sub">${country} · ${formatPeople(inhabitants)} inhab.</div>
      <div class="tip-meta">${source} · ${metric} · ${mean}</div>
      <div class="tip-total">${total} people in mapped bands</div>
      <div class="tip-bands">${rows}</div>
      <div class="tip-note">1 ring ≈ ${formatPeople(PEOPLE_PER_RING)} people (max 12 / band)</div>
    </div>
  `
}

export function NoiseMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const [source, setSource] = useState<NoiseSource>('road')
  const [metric, setMetric] = useState<NoiseMetric>('Lden')
  const [status, setStatus] = useState('Loading map…')

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    ensureMaplibreWorker()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      bounds: EUROPE_BOUNDS,
      fitBoundsOptions: { padding: 48 },
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
      map.addSource(RINGS_SOURCE, {
        type: 'geojson',
        data: DATA_URL,
      })

      map.addLayer({
        id: RINGS_LAYER,
        type: 'line',
        source: RINGS_SOURCE,
        filter: [
          'all',
          ['==', ['get', 'kind'], 'ring'],
          ['==', ['get', 'source'], source],
          ['==', ['get', 'metric'], metric],
        ],
        paint: {
          'line-color': ['get', 'color'],
          'line-opacity': 0.88,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0.6,
            6,
            1.1,
            10,
            1.8,
          ],
        },
      })

      // Invisible hit target over city centers
      map.addLayer({
        id: HIT_LAYER,
        type: 'circle',
        source: RINGS_SOURCE,
        filter: ['==', ['get', 'kind'], 'center'],
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            10,
            7,
            16,
            11,
            22,
          ],
          'circle-color': '#00e5ff',
          'circle-opacity': 0.05,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#00e5ff',
          'circle-stroke-opacity': 0.35,
        },
      })

      map.addLayer({
        id: LABEL_LAYER,
        type: 'symbol',
        source: RINGS_SOURCE,
        filter: ['==', ['get', 'kind'], 'center'],
        layout: {
          'text-field': ['get', 'agglomeration'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            0,
            5,
            10,
            8,
            13,
          ],
          'text-offset': [0, 1.2],
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
            4.5,
            0,
            5.5,
            0.9,
          ],
        },
      })

      setStatus(`${source} · ${metric} · agglomerations`)
    })

    map.on('error', () => {
      setStatus('Map error — check console / data assets')
    })

    return () => {
      popup.remove()
      map.remove()
      mapRef.current = null
      popupRef.current = null
    }
    // source/metric applied in separate effect after load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update ring filter when toggles change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      if (!map.getLayer(RINGS_LAYER)) return
      map.setFilter(RINGS_LAYER, [
        'all',
        ['==', ['get', 'kind'], 'ring'],
        ['==', ['get', 'source'], source],
        ['==', ['get', 'metric'], metric],
      ])
      setStatus(`${source} · ${metric} · agglomerations`)
    }

    if (map.isStyleLoaded() && map.getLayer(RINGS_LAYER)) apply()
    else map.once('load', apply)
  }, [source, metric])

  // Hover tooltip on city centers
  useEffect(() => {
    const map = mapRef.current
    const popup = popupRef.current
    if (!map || !popup) return

    const onMove = (e: maplibregl.MapMouseEvent) => {
      if (!map.getLayer(HIT_LAYER)) return
      const feats = map.queryRenderedFeatures(e.point, { layers: [HIT_LAYER] })
      if (!feats.length) {
        map.getCanvas().style.cursor = ''
        popup.remove()
        return
      }
      map.getCanvas().style.cursor = 'pointer'
      const props = feats[0].properties ?? {}
      let tip: TipPayload | null = null
      try {
        const all = JSON.parse(String(props.tooltip || '{}')) as Record<string, TipPayload>
        tip = all[`${source}__${metric}`] ?? null
      } catch {
        tip = null
      }
      const html = buildTooltipHtml(
        String(props.agglomeration ?? ''),
        String(props.country ?? ''),
        Number(props.inhabitants ?? 0),
        source,
        metric,
        tip,
      )
      popup.setLngLat(e.lngLat).setHTML(html).addTo(map)
    }

    const onLeave = () => {
      map.getCanvas().style.cursor = ''
      popup.remove()
    }

    const bind = () => {
      map.on('mousemove', HIT_LAYER, onMove)
      map.on('mouseleave', HIT_LAYER, onLeave)
    }

    if (map.isStyleLoaded() && map.getLayer(HIT_LAYER)) bind()
    else map.once('load', bind)

    return () => {
      map.off('mousemove', HIT_LAYER, onMove)
      map.off('mouseleave', HIT_LAYER, onLeave)
    }
  }, [source, metric])

  const bands = metric === 'Lden' ? LDEN_BANDS : LNIGHT_BANDS

  return (
    <section className="noise-shell">
      <header className="noise-top">
        <div className="noise-brand">
          <p className="noise-eyebrow">EEA END 2022</p>
          <h1>Europe environmental noise</h1>
          <p className="noise-sub">
            Agglomerations · 1 ring ≈ 10k people · colour = dB band
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
