import type { ChartBand, ChartCity, ChartSeries } from '../components/CityWaveChart'
import { LDEN_BANDS, LNIGHT_BANDS, type NoiseMetric } from './noiseStyle'

const LDEN_KEYS = ['55-59', '60-64', '65-69', '70-74', '>75'] as const
const LNIGHT_KEYS = ['50-54', '55-59', '60-64', '65-69', '>70'] as const

/** Slim on-disk band: label/color/rings are restored at load. */
type SlimBand = { band: string; people: number }

type SlimSeries = {
  mean_db: number | null
  total: number
  bands: SlimBand[]
}

function hydrateBands(metric: NoiseMetric, bands: SlimBand[]): ChartBand[] {
  const meta = metric === 'Lden' ? LDEN_BANDS : LNIGHT_BANDS
  const keys = metric === 'Lden' ? LDEN_KEYS : LNIGHT_KEYS
  const byBand = new Map(bands.map((b) => [b.band, b]))
  return keys.map((band, i) => {
    const hit = byBand.get(band)
    const people = hit?.people ?? 0
    return {
      band,
      label: meta[i]?.label ?? band,
      color: meta[i]?.color ?? '#88aaaa',
      people,
      rings: 0,
    }
  })
}

function metricFromSeriesKey(key: string): NoiseMetric {
  return key.endsWith('Lnight') ? 'Lnight' : 'Lden'
}

/** Restore labels/colors after loading slim agglomeration_chart.json. */
export function hydrateChartCities(
  cities: Array<{
    id: string
    agglomeration: string
    country: string
    inhabitants: number
    lon?: number
    lat?: number
    series: Record<string, SlimSeries | ChartSeries>
  }>,
): ChartCity[] {
  return cities.map((c) => {
    const series: Record<string, ChartSeries> = {}
    for (const [key, tip] of Object.entries(c.series ?? {})) {
      if (!tip) continue
      const metric = metricFromSeriesKey(key)
      const bands = hydrateBands(
        metric,
        (tip.bands ?? []).map((b) => ({
          band: b.band,
          people: Number(b.people) || 0,
        })),
      )
      series[key] = {
        mean_db: tip.mean_db ?? null,
        total: Number(tip.total) || bands.reduce((s, b) => s + b.people, 0),
        bands,
      }
    }
    return {
      id: c.id,
      agglomeration: c.agglomeration,
      country: c.country,
      inhabitants: Number(c.inhabitants) || 0,
      lon: c.lon,
      lat: c.lat,
      series,
    }
  })
}
