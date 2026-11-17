/** Neon dB-band colors (dark neon aesthetic). */

export type NoiseSource = 'road' | 'rail' | 'aircraft' | 'industry'
export type NoiseMetric = 'Lden' | 'Lnight'

export const SOURCES: { id: NoiseSource; label: string }[] = [
  { id: 'road', label: 'Road' },
  { id: 'rail', label: 'Rail' },
  { id: 'aircraft', label: 'Aircraft' },
  { id: 'industry', label: 'Industry' },
]

export const METRICS: { id: NoiseMetric; label: string }[] = [
  { id: 'Lden', label: 'Lden' },
  { id: 'Lnight', label: 'Lnight' },
]

/** Display bands used in legend (END core thresholds + high). */
export const LDEN_BANDS = [
  { category: 'Lden5559', label: '55–59 dB', color: '#3d5afe' },
  { category: 'Lden6064', label: '60–64 dB', color: '#00e5ff' },
  { category: 'Lden6569', label: '65–69 dB', color: '#76ff03' },
  { category: 'Lden7074', label: '70–74 dB', color: '#ffea00' },
  { category: 'LdenGreaterThan75', label: '≥75 dB', color: '#ff1744' },
] as const

export const LNIGHT_BANDS = [
  { category: 'Lnight5054', label: '50–54 dB', color: '#3d5afe' },
  { category: 'Lnight5559', label: '55–59 dB', color: '#00e5ff' },
  { category: 'Lnight6064', label: '60–64 dB', color: '#76ff03' },
  { category: 'Lnight6569', label: '65–69 dB', color: '#ffea00' },
  { category: 'LnightGreaterThan70', label: '≥70 dB', color: '#ff1744' },
] as const

/** Full match-expression covering voluntary lower bands too. */
export function fillColorExpression(metric: NoiseMetric): unknown[] {
  const pairs =
    metric === 'Lden'
      ? [
          'LdenLowerThan40',
          '#1a237e',
          'Lden4044',
          '#283593',
          'Lden4549',
          '#303f9f',
          'Lden5054',
          '#3949ab',
          'Lden5559',
          '#3d5afe',
          'Lden6064',
          '#00e5ff',
          'Lden6569',
          '#76ff03',
          'Lden7074',
          '#ffea00',
          'LdenGreaterThan75',
          '#ff1744',
        ]
      : [
          'LnightLowerThan40',
          '#1a237e',
          'Lnight4044',
          '#283593',
          'Lnight4549',
          '#303f9f',
          'Lnight5054',
          '#3d5afe',
          'Lnight5559',
          '#00e5ff',
          'Lnight6064',
          '#76ff03',
          'Lnight6569',
          '#ffea00',
          'LnightGreaterThan70',
          '#ff1744',
        ]

  return ['match', ['get', 'category'], ...pairs, '#ff00ff']
}

export function pmtilesUrl(source: NoiseSource, metric: NoiseMetric): string {
  return `/data/end_${source}_${metric.toLowerCase()}.pmtiles`
}

export const EUROPE_BOUNDS: [[number, number], [number, number]] = [
  [-12, 34],
  [32, 72],
]
