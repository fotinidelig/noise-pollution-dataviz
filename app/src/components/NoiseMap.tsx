import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  EUROPE_BOUNDS,
  fillColorExpression,
  LDEN_BANDS,
  LNIGHT_BANDS,
  METRICS,
  pmtilesUrl,
  SOURCES,
  type NoiseMetric,
  type NoiseSource,
} from '../lib/noiseStyle'
import './NoiseMap.css'

const SOURCE_ID = 'end-contours'
const FILL_LAYER = 'end-contours-fill'
const LINE_LAYER = 'end-contours-line'

let protocolRegistered = false

function ensurePmtilesProtocol() {
  if (protocolRegistered) return
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile)
  protocolRegistered = true
}

function assetExists(path: string): Promise<boolean> {
  return fetch(path, { method: 'HEAD' })
    .then((r) => {
      if (r.ok) return true
      // Some static servers skip HEAD — fall back to ranged GET
      if (r.status === 405 || r.status === 501) {
        return fetch(path, { method: 'GET', headers: { Range: 'bytes=0-0' } }).then(
          (g) => g.ok || g.status === 206,
        )
      }
      return false
    })
    .catch(() => false)
}

export function NoiseMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [source, setSource] = useState<NoiseSource>('road')
  const [metric, setMetric] = useState<NoiseMetric>('Lden')
  const [status, setStatus] = useState('Loading map…')
  const [readyAssets, setReadyAssets] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const checks: Record<string, boolean> = {}
      for (const s of SOURCES) {
        for (const m of METRICS) {
          const url = pmtilesUrl(s.id, m.id)
          checks[`${s.id}-${m.id}`] = await assetExists(url)
        }
      }
      if (!cancelled) setReadyAssets(checks)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    ensurePmtilesProtocol()

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      bounds: EUROPE_BOUNDS,
      fitBoundsOptions: { padding: 48 },
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right')
    mapRef.current = map

    map.on('load', () => setStatus('Map ready'))
    map.on('error', (e: maplibregl.ErrorEvent) => {
      console.error(e)
      setStatus('Map error — check console / data assets')
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const url = pmtilesUrl(source, metric)
    const key = `${source}-${metric}`
    const available = readyAssets[key]

    const apply = () => {
      if (available === false) {
        if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER)
        if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
        setStatus(`No tiles yet for ${source} · ${metric}`)
        return
      }
      if (available === undefined) {
        setStatus('Checking data assets…')
        return
      }

      const tilesUrl = `pmtiles://${window.location.origin}${url}`
      const fillPaint = {
        'fill-color': fillColorExpression(metric) as maplibregl.ExpressionSpecification,
        'fill-opacity': 0.55,
      }

      const linePaint = {
        'line-color': fillColorExpression(metric) as maplibregl.ExpressionSpecification,
        'line-opacity': 0.85,
        'line-width': 0.6,
      }

      if (map.getSource(SOURCE_ID)) {
        // Swap source by recreate (MapLibre can't change vector URL in place reliably)
        if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER)
        if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER)
        map.removeSource(SOURCE_ID)
      }

      map.addSource(SOURCE_ID, {
        type: 'vector',
        url: tilesUrl,
      })
      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        'source-layer': 'contours',
        paint: fillPaint,
      })
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'contours',
        paint: linePaint,
      })
      setStatus(`${source} · ${metric}`)
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [source, metric, readyAssets])

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
        <div className="noise-legend" aria-label="dB band legend">
          {bands.map((b) => (
            <div key={b.category} className="noise-legend__row">
              <span className="swatch" style={{ background: b.color }} />
              <span>{b.label}</span>
            </div>
          ))}
        </div>
        <p className="noise-status">{status}</p>
      </div>
    </section>
  )
}
