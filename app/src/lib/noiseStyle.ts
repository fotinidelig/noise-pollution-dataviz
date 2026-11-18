/** dB-band colors for rings, tips, and sidecar. */

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
  { category: 'Lden5559', label: '55–59 dB', color: '#7186FE' },
  { category: 'Lden6064', label: '60–64 dB', color: '#70F1FF' },
  { category: 'Lden6569', label: '65–69 dB', color: '#D2FFAD' },
  { category: 'Lden7074', label: '70–74 dB', color: '#FF9C33' },
  { category: 'LdenGreaterThan75', label: '≥75 dB', color: '#FF476C' },
] as const

export const LNIGHT_BANDS = [
  { category: 'Lnight5054', label: '50–54 dB', color: '#7186FE' },
  { category: 'Lnight5559', label: '55–59 dB', color: '#70F1FF' },
  { category: 'Lnight6064', label: '60–64 dB', color: '#D2FFAD' },
  { category: 'Lnight6569', label: '65–69 dB', color: '#FF9C33' },
  { category: 'LnightGreaterThan70', label: '≥70 dB', color: '#FF476C' },
] as const

export const EUROPE_BOUNDS: [[number, number], [number, number]] = [
  [-12, 34],
  [32, 72],
]
