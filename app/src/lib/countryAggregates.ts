import type { Feature, FeatureCollection } from 'geojson'
import type { NoiseMetric, NoiseSource } from './noiseStyle'
import { aggregateBands, seriesToBands, type BandPeople } from './ringGeometry'
import type { ChartCity, ChartSeries, HoverSeries } from '../components/CityWaveChart'

export const MAX_UNITS_PER_COUNTRY_FOR_COUNTRY_VIEW = 2

export type CountryAgg = {
  country: string
  id: string
  lon: number
  lat: number
  cityCount: number
  inhabitants: number
  bands: BandPeople[]
  total: number
  series: HoverSeries
}

export function buildCountryAggregates(
  cities: ChartCity[],
  source: NoiseSource,
  metric: NoiseMetric,
): CountryAgg[] {
  const key = `${source}__${metric}`
  type Acc = {
    country: string
    sumLon: number
    sumLat: number
    n: number
    inhabitants: number
    tips: ChartSeries[]
  }
  const byCountry = new Map<string, Acc>()

  for (const c of cities) {
    if (c.lon == null || c.lat == null) continue
    const tip = c.series[key]
    if (!tip || !(tip.total > 0)) continue
    const acc = byCountry.get(c.country) ?? {
      country: c.country,
      sumLon: 0,
      sumLat: 0,
      n: 0,
      inhabitants: 0,
      tips: [],
    }
    acc.sumLon += c.lon
    acc.sumLat += c.lat
    acc.n += 1
    acc.inhabitants += c.inhabitants || 0
    acc.tips.push(tip)
    byCountry.set(c.country, acc)
  }

  const out: CountryAgg[] = []
  for (const acc of byCountry.values()) {
    const bands = aggregateBands(metric, acc.tips)
    const total = bands.reduce((s, b) => s + b.people, 0)
    if (total <= 0 || acc.n === 0) continue
    const id = `country:${acc.country}`
    const series: HoverSeries = {
      id,
      name: acc.country,
      total,
      points: bands.map((b) => ({
        band: b.band,
        label: b.label,
        color: b.color,
        people: b.people,
      })),
    }
    out.push({
      country: acc.country,
      id,
      lon: acc.sumLon / acc.n,
      lat: acc.sumLat / acc.n,
      cityCount: acc.n,
      inhabitants: acc.inhabitants,
      bands,
      total,
      series,
    })
  }
  return out.sort((a, b) => a.country.localeCompare(b.country))
}

export function countriesToGeoJSON(countries: CountryAgg[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: countries.map(
      (c) =>
        ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
          properties: {
            id: c.id,
            kind: 'country',
            country: c.country,
            cityCount: c.cityCount,
            inhabitants: c.inhabitants,
            total: c.total,
            series: JSON.stringify(c.series),
          },
        }) satisfies Feature,
    ),
  }
}

/** Parse tip JSON from a city leaf / point. */
export function tipFromProps(
  tooltipRaw: unknown,
  source: NoiseSource,
  metric: NoiseMetric,
): ChartSeries | null {
  try {
    const all = JSON.parse(String(tooltipRaw || '{}')) as Record<string, ChartSeries>
    const tip = all[`${source}__${metric}`]
    return tip && tip.total > 0 ? tip : null
  } catch {
    return null
  }
}

export function seriesFromBands(
  id: string,
  name: string,
  bands: BandPeople[],
): HoverSeries {
  const total = bands.reduce((s, b) => s + b.people, 0)
  return {
    id,
    name,
    total,
    points: bands.map((b) => ({
      band: b.band,
      label: b.label,
      color: b.color,
      people: b.people,
    })),
  }
}

export { seriesToBands }
