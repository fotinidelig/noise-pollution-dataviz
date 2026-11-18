import { useEffect, useMemo, useRef, useState } from 'react'
import { NoiseMap, type StoryMapControl } from '../components/NoiseMap'
import { buildSteps } from './buildSteps'
import { ProgressRail } from './ProgressRail'
import type { StoryMetrics, StoryStepId } from './storyTypes'
import './scrolly.css'

const STORY_URL = '/data/scrolly_story_v1.json'

/**
 * × on each story card dismisses the narrative overlay and jumps to Explore
 * (free pan/zoom). Progress-rail clicks reopen that beat and show the card again.
 */
export function ScrollyApp() {
  const [metrics, setMetrics] = useState<StoryMetrics | null>(null)
  const [activeId, setActiveId] = useState<StoryStepId>('hero')
  const [dismissed, setDismissed] = useState(false)
  const stepRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    let cancelled = false
    fetch(STORY_URL)
      .then((r) => r.json())
      .then((data: StoryMetrics) => {
        if (!cancelled) setMetrics(data)
      })
      .catch(() => {
        if (!cancelled) setMetrics(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const steps = useMemo(() => (metrics ? buildSteps(metrics) : []), [metrics])
  const exploreStep = steps.find((s) => s.id === 'explore')
  const active = dismissed
    ? exploreStep ?? steps[0]
    : (steps.find((s) => s.id === activeId) ?? steps[0])

  useEffect(() => {
    if (!steps.length || dismissed) return
    const nodes = steps
      .map((s) => stepRefs.current[s.id])
      .filter((n): n is HTMLElement => Boolean(n))
    if (!nodes.length) return

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (!top) return
        const id = (top.target as HTMLElement).dataset.stepId as StoryStepId
        if (id) setActiveId(id)
      },
      { root: null, threshold: [0.35, 0.55, 0.7], rootMargin: '-10% 0px -35% 0px' },
    )
    for (const n of nodes) obs.observe(n)
    return () => obs.disconnect()
  }, [steps, dismissed])

  const mapControl: StoryMapControl | null = active?.map
    ? {
        center: active.map.center,
        zoom: active.map.zoom,
        source: active.map.source,
        metric: active.map.metric,
        highlightId: active.map.highlightId ?? null,
        explore: Boolean(active.explore) || dismissed,
        stepId: dismissed ? 'explore' : active.id,
      }
    : null

  const jump = (id: string) => {
    if (id !== 'explore') setDismissed(false)
    const el = stepRefs.current[id]
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id as StoryStepId)
  }

  const dismissStory = () => {
    setDismissed(true)
    setActiveId('explore')
    const el = stepRefs.current.explore
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!metrics || !steps.length) {
    return (
      <main className="scrolly-root">
        <p className="scrolly-loading">Loading story…</p>
      </main>
    )
  }

  return (
    <main className={`scrolly-root${dismissed ? ' is-dismissed' : ''}`}>
      <ProgressRail steps={steps} activeId={active.id} onJump={jump} />

      <div className="scrolly-map-sticky">
        <NoiseMap story={mapControl} />
      </div>

      <div className="scrolly-steps" aria-hidden={dismissed}>
        {steps.map((step) => (
          <section
            key={step.id}
            className={`scrolly-step${step.id === 'hero' ? ' scrolly-step--hero' : ''}${step.id === active.id && !dismissed ? ' is-active' : ''}`}
            data-step-id={step.id}
            ref={(el) => {
              stepRefs.current[step.id] = el
            }}
          >
            {!dismissed ? (
              <div className="scrolly-step__card">
                <button
                  type="button"
                  className="scrolly-step__close"
                  aria-label="Close story and explore the map"
                  title="Close story · explore map"
                  onClick={dismissStory}
                >
                  ×
                </button>
                {step.year != null ? (
                  <p className="scrolly-step__year">Year {step.year}</p>
                ) : null}
                <h2 className="scrolly-step__title">{step.title}</h2>
                {step.body.map((p) => (
                  <p
                    key={p.slice(0, 48)}
                    className="scrolly-step__body"
                    dangerouslySetInnerHTML={{
                      __html: p
                        .replace(/\*\*(.+?)\*\*/g, '<span class="scrolly-hi">$1</span>')
                        .replace(/\n/g, '<br/>'),
                    }}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  )
}
