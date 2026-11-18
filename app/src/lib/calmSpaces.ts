/** Calm / quiet place anchors for map bubbles + scatter chart. */

export type CalmPeriod = 'day' | 'night'

export type CalmPlace = {
  id: string
  label: string
  shortLabel: string
  country: string
  city: string
  continent: string
  setting: string
  lon: number
  lat: number
  /** Plot when present — single-value places use only one. */
  day_db: number | null
  night_db: number | null
  metric: string
  year: string
  /** measured = instrumented / reported levels; policy = END designation thresholds. */
  kind: 'measured' | 'policy'
  storytelling_rank: number | null
}

export type CalmSpacesData = {
  version: number
  note?: string
  dayColor: string
  nightColor: string
  places: CalmPlace[]
}

export type CalmPoint = {
  placeId: string
  period: CalmPeriod
  db: number
  place: CalmPlace
  /** Index along X after hierarchical sort. */
  xIndex: number
}

export function placeLoudness(p: CalmPlace): number {
  const vals = [p.day_db, p.night_db].filter((v): v is number => v != null)
  return vals.length ? Math.max(...vals) : 0
}

export function placeQuietness(p: CalmPlace): number {
  const vals = [p.day_db, p.night_db].filter((v): v is number => v != null)
  return vals.length ? Math.min(...vals) : 0
}

/**
 * Continent → country → city clusters; within each level louder (higher dB) left,
 * calmer right. Measured sites first within a city, then policy markers.
 */
export function orderCalmPlaces(places: CalmPlace[]): CalmPlace[] {
  const byContinent = new Map<string, CalmPlace[]>()
  for (const p of places) {
    const list = byContinent.get(p.continent) ?? []
    list.push(p)
    byContinent.set(p.continent, list)
  }

  const continentOrder = [...byContinent.entries()].sort(
    (a, b) =>
      Math.max(...b[1].map(placeLoudness)) - Math.max(...a[1].map(placeLoudness)),
  )

  const out: CalmPlace[] = []
  for (const [, continentPlaces] of continentOrder) {
    const byCountry = new Map<string, CalmPlace[]>()
    for (const p of continentPlaces) {
      const list = byCountry.get(p.country) ?? []
      list.push(p)
      byCountry.set(p.country, list)
    }
    const countryOrder = [...byCountry.entries()].sort(
      (a, b) =>
        Math.max(...b[1].map(placeLoudness)) -
        Math.max(...a[1].map(placeLoudness)),
    )
    for (const [, countryPlaces] of countryOrder) {
      const byCity = new Map<string, CalmPlace[]>()
      for (const p of countryPlaces) {
        const list = byCity.get(p.city) ?? []
        list.push(p)
        byCity.set(p.city, list)
      }
      const cityOrder = [...byCity.entries()].sort(
        (a, b) =>
          Math.max(...b[1].map(placeLoudness)) -
          Math.max(...a[1].map(placeLoudness)),
      )
      for (const [, cityPlaces] of cityOrder) {
        cityPlaces.sort((a, b) => {
          const kindRank = (a.kind === 'measured' ? 0 : 1) - (b.kind === 'measured' ? 0 : 1)
          if (kindRank !== 0) return kindRank
          return placeLoudness(b) - placeLoudness(a)
        })
        out.push(...cityPlaces)
      }
    }
  }
  return out
}

/** Expand places into day/night points (whichever values exist). */
export function buildCalmPoints(places: CalmPlace[]): CalmPoint[] {
  const ordered = orderCalmPlaces(places)
  const points: CalmPoint[] = []
  ordered.forEach((place, xIndex) => {
    if (place.day_db != null) {
      points.push({ placeId: place.id, period: 'day', db: place.day_db, place, xIndex })
    }
    if (place.night_db != null) {
      points.push({ placeId: place.id, period: 'night', db: place.night_db, place, xIndex })
    }
  })
  return points
}

/** Lower dB → larger bubble (quietness). */
export function quietnessRadius(
  db: number,
  dbMin: number,
  dbMax: number,
  rMin = 8,
  rMax = 28,
): number {
  if (dbMax <= dbMin) return (rMin + rMax) / 2
  const t = (dbMax - db) / (dbMax - dbMin)
  return rMin + Math.max(0, Math.min(1, t)) * (rMax - rMin)
}

export function calmPlacesToGeoJSON(places: CalmPlace[]) {
  // Measured / monitored sites only — skip END designation thresholds
  places = places.filter((p) => p.kind !== 'policy')
  const dbs = places.flatMap((p) =>
    [p.day_db, p.night_db].filter((v): v is number => v != null),
  )
  if (!dbs.length) {
    return { type: 'FeatureCollection' as const, features: [] }
  }
  const dbMin = Math.min(...dbs)
  const dbMax = Math.max(...dbs)
  return {
    type: 'FeatureCollection' as const,
    features: places.map((p) => {
      const quiet = placeQuietness(p)
      const loud = placeLoudness(p)
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [p.lon, p.lat],
        },
        properties: {
          id: p.id,
          label: p.label,
          shortLabel: p.shortLabel,
          country: p.country,
          city: p.city,
          continent: p.continent,
          setting: p.setting,
          kind: p.kind,
          metric: p.metric,
          year: p.year,
          day_db: p.day_db,
          night_db: p.night_db,
          quiet_db: quiet,
          loud_db: loud,
          radius: quietnessRadius(quiet, dbMin, dbMax, 10, 30),
        },
      }
    }),
  }
}
