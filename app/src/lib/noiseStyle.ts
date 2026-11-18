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
  { category: 'Lden6064', label: '60–64 dB', color: '#00B8CC' },
  { category: 'Lden6569', label: '65–69 dB', color: '#00CC66' },
  { category: 'Lden7074', label: '70–74 dB', color: '#ffea00' },
  { category: 'LdenGreaterThan75', label: '≥75 dB', color: '#ff1744' },
] as const

export const LNIGHT_BANDS = [
  { category: 'Lnight5054', label: '50–54 dB', color: '#3d5afe' },
  { category: 'Lnight5559', label: '55–59 dB', color: '#00B8CC' },
  { category: 'Lnight6064', label: '60–64 dB', color: '#00CC66' },
  { category: 'Lnight6569', label: '65–69 dB', color: '#ffea00' },
  { category: 'LnightGreaterThan70', label: '≥70 dB', color: '#ff1744' },
] as const

export const EUROPE_BOUNDS: [[number, number], [number, number]] = [
  [-12, 34],
  [32, 72],
]
