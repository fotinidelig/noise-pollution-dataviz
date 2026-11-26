import type { StoryStepId } from './storyTypes'

/** Standalone Pages: activate as a beat enters the upper half of the viewport. */
export const STANDALONE_ROOT_MARGIN = '0px 0px -48% 0px'

/**
 * Embed / tall iframe: softer band so short cards still register inside a
 * tall iframe viewport. Never use root:document (invalid for IntersectionObserver).
 */
export const EMBED_ROOT_MARGIN = '0px 0px -18% 0px'

export const STEP_THRESHOLDS = [0.05, 0.12, 0.22, 0.35, 0.5]

/** Cross-origin access to `top` throws — treat that as framed. */
export function isFramedContext(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * Document much taller than the browsing-context viewport.
 * Secondary signal for embed-like layouts (iframe with internal scroll).
 */
export function isDocumentMuchTallerThanViewport(ratio = 1.75): boolean {
  if (typeof window === 'undefined') return false
  const docH = document.documentElement?.scrollHeight ?? 0
  const viewH = window.innerHeight || 1
  return docH > viewH * ratio
}

/**
 * Use embed-safe active-step detection when framed (Vercel iframe / workshop
 * embed). Standalone Pages stay on the original upper-half IO path even when
 * the story document is tall — required so scrolly map timing stays correct.
 */
export function isEmbedLikeContext(): boolean {
  return isFramedContext()
}

/**
 * Pick the step whose vertical midpoint is closest to the iframe/viewport
 * center. Used as embed fallback when IntersectionObserver under-fires.
 */
export function pickStepClosestToViewportCenter(
  nodes: HTMLElement[],
): StoryStepId | null {
  if (!nodes.length) return null
  const viewH = window.innerHeight || 0
  if (viewH <= 0) return null
  const centerY = viewH / 2

  let bestId: StoryStepId | null = null
  let bestDist = Infinity

  for (const el of nodes) {
    const rect = el.getBoundingClientRect()
    // Prefer steps that intersect the viewport.
    if (rect.bottom <= 0 || rect.top >= viewH) continue
    const mid = rect.top + rect.height / 2
    const dist = Math.abs(mid - centerY)
    const id = el.dataset.stepId as StoryStepId | undefined
    if (id && dist < bestDist) {
      bestDist = dist
      bestId = id
    }
  }

  // If every step is off-screen (extreme scroll), nearest mid anyway so
  // activeId (map camera / rail) never goes stale.
  if (!bestId) {
    for (const el of nodes) {
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      const dist = Math.abs(mid - centerY)
      const id = el.dataset.stepId as StoryStepId | undefined
      if (id && dist < bestDist) {
        bestDist = dist
        bestId = id
      }
    }
  }

  return bestId
}
