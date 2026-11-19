/**
 * Shared Motion tweens for scrolly UI (story fade, title, grain veil,
 * rail highlight, fact boxes, scroll chevrons). Canvas grain physics stay
 * separate — only opacity/timing should match these curves.
 */

/** Soft ease-in-out — primary UI enter/exit. */
export const easeInOutSoft = [0.45, 0, 0.55, 1] as const

/** Soft ease-out — titles / emphasis reveals. */
export const easeOutSoft = [0.22, 1, 0.36, 1] as const

export const motionDur = {
  /** Story card / stack hide-show */
  card: 0.28,
  /** Fact box stagger step */
  fact: 0.32,
  /** Progress rail color / scale */
  rail: 0.22,
  /** Sound grain veil + canvas alpha */
  grain: 0.48,
  /** Explore brand title */
  title: 0.65,
  /** Scroll chevron bob cycle */
  bob: 1.6,
} as const

export const cardFade = {
  duration: motionDur.card,
  ease: easeInOutSoft,
} as const

export const factFade = {
  duration: motionDur.fact,
  ease: easeOutSoft,
} as const

export const railTween = {
  duration: motionDur.rail,
  ease: easeInOutSoft,
} as const

export const grainFade = {
  duration: motionDur.grain,
  ease: easeInOutSoft,
} as const

export const titleFade = {
  duration: motionDur.title,
  ease: easeOutSoft,
} as const

export const bobTween = {
  duration: motionDur.bob,
  ease: 'easeInOut' as const,
  repeat: Infinity,
} as const

/** Same cubic as easeInOutSoft, for imperative canvas alpha sync. */
export function easeInOutCubic(u: number): number {
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2
}
