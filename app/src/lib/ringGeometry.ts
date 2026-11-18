import type { Feature } from 'geojson'
import type { NoiseMetric, NoiseSource } from './noiseStyle'
import { LDEN_BANDS, LNIGHT_BANDS } from './noiseStyle'

export const PEOPLE_PER_RING = 10_000
export const MAX_RINGS_PER_BAND = 12
/** Constant radial step between consecutive rings (km). */
export const RING_STEP_KM = 0.55
export const RING_BASE_KM = 1.2
export const RING_VERTICES = 48
/** Extra expanding pulse rings beyond the last static ring. */
export const PULSE_OUTER_COUNT = 6
/**
 * Outer pulse extent is a fraction of each agglomeration’s max static radius
 * (smaller clusters → smaller waves). City zoom stays tight; overview still clears the blob.
 */
export const PULSE_CITY_CLEARANCE_FRAC = 0.08
export const PULSE_CITY_EXTENT_FRAC = 0.38
export const PULSE_OVERVIEW_CLEARANCE_FRAC = 0.5
export const PULSE_OVERVIEW_EXTENT_FRAC = 2.2
/** Below this zoom, pulse only on far outer rings (stack twins collapse to a blob). */
export const PULSE_STACK_MIN_ZOOM = 5.4

export const LDEN_KEYS = ['55-59', '60-64', '65-69', '70-74', '>75'] as const
export const LNIGHT_KEYS = ['50-54', '55-59', '60-64', '65-69', '>70'] as const

export type BandPeople = { band: string; label: string; color: string; people: number }

export function bandDefs(metric: NoiseMetric) {
  const keys = metric === 'Lden' ? LDEN_KEYS : LNIGHT_KEYS
  const meta = metric === 'Lden' ? LDEN_BANDS : LNIGHT_BANDS
  return keys.map((band, i) => ({
    band,
    label: meta[i]?.label ?? band,
    color: meta[i]?.color ?? '#88aaaa',
  }))
}

export function ringsForPeople(people: number): number {
  if (people <= 0) return 0
  return Math.min(MAX_RINGS_PER_BAND, Math.max(1, Math.ceil(people / PEOPLE_PER_RING)))
}

export function ringCoords(
  lon: number,
  lat: number,
  radiusKm: number,
  n = RING_VERTICES,
): [number, number][] {
  const latRad = (lat * Math.PI) / 180
  const degLat = radiusKm / 111.32
  const degLon = radiusKm / (111.32 * Math.max(Math.cos(latRad), 0.2))
  const coords: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const ang = (2 * Math.PI * i) / n
    coords.push([
      Number((lon + degLon * Math.cos(ang)).toFixed(5)),
      Number((lat + degLat * Math.sin(ang)).toFixed(5)),
    ])
  }
  return coords
}

/** Soft cyan-gray pulse — visible on dark basemap, lower chroma than band neon. */
export const PULSE_COLOR = '#9bb7c2'

/**
 * Build equally spaced rings across bands (no extra gap when a band has fewer rings).
 * Colour still encodes dB band; radius only depends on cumulative ring index.
 * Emits `role:'pulse'` copies through the full stack + outer rings so the sound-wave
 * travels across the visible rings (not only past them).
 */
export function buildEqualSpacedRings(args: {
  lon: number
  lat: number
  source: NoiseSource
  metric: NoiseMetric
  bands: BandPeople[]
  id: string
  label: string
  /** Map zoom — drives whether pulse twins the stack or only far outer rings. */
  zoom?: number
}): Feature[] {
  const features: Feature[] = []
  let ringIndex = 0
  const zoom = args.zoom ?? 6
  const pulseStack = zoom >= PULSE_STACK_MIN_ZOOM

  const pushPulse = (radiusKm: number, index: number) => {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: ringCoords(args.lon, args.lat, radiusKm),
      },
      properties: {
        kind: 'ring',
        role: 'pulse',
        id: args.id,
        label: args.label,
        source: args.source,
        metric: args.metric,
        band: 'pulse',
        band_label: 'pulse',
        color: PULSE_COLOR,
        people: 0,
        ring_index: index,
        radius_km: Number(radiusKm.toFixed(3)),
      },
    })
  }

  for (const b of args.bands) {
    const n = ringsForPeople(b.people)
    for (let i = 0; i < n; i++) {
      const radiusKm = RING_BASE_KM + ringIndex * RING_STEP_KM
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: ringCoords(args.lon, args.lat, radiusKm),
        },
        properties: {
          kind: 'ring',
          role: 'static',
          id: args.id,
          label: args.label,
          source: args.source,
          metric: args.metric,
          band: b.band,
          band_label: b.label,
          color: b.color,
          people: b.people,
          ring_index: ringIndex,
          radius_km: Number(radiusKm.toFixed(3)),
        },
      })
      // At city zoom, twin the stack so the crest travels through visible rings.
      // At overview, skip twins — they collapse into an opaque blob.
      if (pulseStack) pushPulse(radiusKm, ringIndex)
      ringIndex += 1
    }
  }

  const lastStaticRadius =
    ringIndex > 0
      ? RING_BASE_KM + (ringIndex - 1) * RING_STEP_KM
      : RING_BASE_KM

  // Outer wave — proportional to this cluster’s max static radius
  let pulseIndex = pulseStack ? ringIndex : 0
  const clearanceFrac = pulseStack
    ? PULSE_CITY_CLEARANCE_FRAC
    : PULSE_OVERVIEW_CLEARANCE_FRAC
  const extentFrac = pulseStack
    ? PULSE_CITY_EXTENT_FRAC
    : PULSE_OVERVIEW_EXTENT_FRAC
  const clearance = lastStaticRadius * clearanceFrac
  const span = Math.max(clearance, lastStaticRadius * extentFrac)
  const step =
    PULSE_OUTER_COUNT > 1
      ? (span - clearance) / (PULSE_OUTER_COUNT - 1)
      : span
  for (let i = 0; i < PULSE_OUTER_COUNT; i++) {
    const radiusKm = lastStaticRadius + clearance + i * step
    pushPulse(radiusKm, pulseIndex)
    pulseIndex += 1
  }

  return features
}

export function seriesToBands(
  metric: NoiseMetric,
  tip: { bands: { band: string; label: string; color: string; people: number }[] } | null | undefined,
): BandPeople[] {
  const defs = bandDefs(metric)
  const byBand = new Map((tip?.bands ?? []).map((b) => [b.band, b]))
  return defs.map((d) => {
    const hit = byBand.get(d.band)
    return {
      band: d.band,
      label: d.label,
      color: hit?.color ?? d.color,
      people: hit?.people ?? 0,
    }
  })
}

export function aggregateBands(
  metric: NoiseMetric,
  tips: Array<{ bands: { band: string; people: number; color?: string; label?: string }[] }>,
): BandPeople[] {
  const defs = bandDefs(metric)
  return defs.map((d) => {
    let people = 0
    for (const tip of tips) {
      const hit = tip.bands.find((b) => b.band === d.band)
      people += hit?.people ?? 0
    }
    return { ...d, people }
  })
}
