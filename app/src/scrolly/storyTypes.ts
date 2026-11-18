import type { NoiseMetric, NoiseSource } from '../lib/noiseStyle'

export type StoryMetrics = {
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
    common_sound: { sound_name: string; db_min: number; db_max: number }
  }
  paris: {
    year: number
    loudest_site: string
    max_db: number
    lon: number
    lat: number
    plain?: string
    common_sound: { sound_name: string; db_min: number; db_max: number }
  }
  madrid: {
    year: number
    loudest_station_id: number
    max_db_median: number
    max_db_peak: number
    lon: number
    lat: number
    plain?: string
    common_sound: { sound_name: string; db_min: number; db_max: number }
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
    common_sound: { sound_name: string; db_min: number; db_max: number }
  }
  seoul: {
    year: number
    loudest_site: string
    max_db_median: number
    max_db_peak: number
    lon: number
    lat: number
    plain?: string
    common_sound: { sound_name: string; db_min: number; db_max: number }
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
  | 'explore'

export type StoryStep = {
  id: StoryStepId
  railLabel: string
  year?: number | string
  title: string
  questions: string[]
  body: string[]
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
