import type { NoiseMetric, NoiseSource } from '../lib/noiseStyle'

export type CommonSound = {
  sound_name: string
  db_min: number
  db_max: number
  mid?: number
}

/** Fotini-locked anchors for loudness compares. */
export const VACUUM: CommonSound = {
  sound_name: 'Vacuum cleaner',
  db_min: 70,
  db_max: 70,
  mid: 70,
}

export const BLENDER: CommonSound = {
  sound_name: 'Blender',
  db_min: 80,
  db_max: 90,
  mid: 85,
}

export type StoryMetrics = {
  common_sounds?: {
    vacuum: CommonSound
    blender: CommonSound
    note?: string
  }
  europe: {
    year_label: number
    people_highly_annoyed: number
    people_highly_sleep_disturbed: number
    people_exposed_lden_end_bands: number
    by_source_ha: Record<string, number>
    who_guideline_note?: string
  }
  germany: {
    agglomeration: string
    id: string
    lon: number
    lat: number
    band: string
    year_label: number
    high_band_people_germany: number
    high_band_people_berlin: number
    berlin_share_of_germany_pct: number
    high_band_people_europe: number
    berlin_share_of_europe_pct: number
    road_only?: {
      germany: number
      berlin: number
      berlin_share_of_germany_pct: number | null
    }
    frame?: string
    common_sound?: CommonSound
  }
  paris: {
    year: number
    loudest_site: string
    max_db: number
    lon: number
    lat: number
    plain?: string
    common_sound?: CommonSound
    /** END road WHO HA/HSD for agglomeration Paris (ThemeRiver source). */
    end_year?: number
    agglomeration?: string
    road_ha?: number
    road_hsd?: number
  }
  madrid: {
    year: number
    loudest_station_id: number
    max_db_median: number
    max_db_peak: number
    lon: number
    lat: number
    plain?: string
    common_sound?: CommonSound
  }
  hong_kong: {
    year: number
    max_db: number
    pct_valid_gt70: number
    area_km2_gt70: number
    lon: number
    lat: number
    method: string
    plain?: string
    common_sound?: CommonSound
    overlay?: string
  }
  seoul: {
    year: number
    loudest_site: string
    loudest_site_ko?: string
    peak_site?: string
    peak_site_ko?: string
    max_db_median: number
    max_db_peak: number
    lon: number
    lat: number
    plain?: string
    common_sound?: CommonSound
    sites_geojson?: string
    geocode_caveat?: string
  }
}

export type StoryStepId =
  | 'hero'
  | 'europe'
  | 'germany'
  | 'paris'
  | 'madrid'
  | 'hongkong'
  | 'seoul'
  | 'calm'
  | 'explore'

export type StoryStat = {
  /** Big figure shown in the intro row (e.g. "1 in 5", "~3.3M"). */
  value: string
  /** Short label under the figure. */
  label: string
}

export type StoryStep = {
  id: StoryStepId
  railLabel: string
  year?: number | string
  title: string
  /** Optional line under the title (hero intro). */
  subtitle?: string
  questions: string[]
  body: string[]
  /** Intro wireframe: one row of big numbers with short labels. */
  stats?: StoryStat[]
  map?: {
    center: [number, number]
    zoom: number
    source?: NoiseSource
    metric?: NoiseMetric
    highlightId?: string | null
  }
  explore?: boolean
}

export function formatPeople(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} million`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

export function soundRange(s: { sound_name: string; db_min: number; db_max: number }) {
  if (s.db_min === s.db_max) return `${s.db_min} dB · ${s.sound_name}`
  return `${s.db_min}–${s.db_max} dB · ${s.sound_name}`
}

/** Map a measured level onto vacuum (~70) ↔ blender (~80–90). */
export function vacuumBlenderCompare(db: number): string {
  const rounded = Math.round(db)
  if (db < 68) {
    return `quieter than a vacuum cleaner (~70 dB) — around ${rounded} dB`
  }
  if (db <= 72) {
    return `about as loud as a vacuum cleaner (~70 dB)`
  }
  if (db < 78) {
    return `between a vacuum cleaner (~70 dB) and a blender (~80–90 dB) — around ${rounded} dB`
  }
  if (db <= 92) {
    return `toward a blender (~80–90 dB) — around ${rounded} dB`
  }
  return `louder than a blender (~80–90 dB) — around ${rounded} dB`
}
