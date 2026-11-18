import { useEffect, useMemo, useRef, useState } from 'react'
import { NoiseMap, type StoryMapControl } from '../components/NoiseMap'
import { buildSteps } from './buildSteps'
import { ProgressRail } from './ProgressRail'
import { SoundGrainOverlay } from './SoundGrainOverlay'
import {
  SoundScale,
  grainIntensity,
  type SoundAnchor,
} from './SoundScale'
import type { StoryMetrics, StoryStepId } from './storyTypes'
import './scrolly.css'

const STORY_URL = `${import.meta.env.BASE_URL || '/'}data/scrolly_story_v1.json`

/**
 * × on each story card dismisses the narrative overlay and jumps to Explore
 * (free pan/zoom). Progress-rail clicks reopen that beat and show the card again.
 *
 * Hong Kong / Seoul overlays unlock when first visited and stay visible for the
 * rest of the story (including Explore) so scrolling back still shows the data.
 */
export function ScrollyApp() {
  const [metrics, setMetrics] = useState<StoryMetrics | null>(null)
  const [activeId, setActiveId] = useState<StoryStepId>('hero')
  const [dismissed, setDismissed] = useState(false)
  const [unlocked, setUnlocked] = useState({ hongkong: false, seoul: false })
  const [playingSound, setPlayingSound] = useState<SoundAnchor | null>(null)
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

  // Unlock on the same render as the step (avoid one-frame race with map overlays)
  const overlays = useMemo(
    () => ({
      hongkong: unlocked.hongkong || activeId === 'hongkong',
      seoul: unlocked.seoul || activeId === 'seoul',
    }),
    [unlocked.hongkong, unlocked.seoul, activeId],
  )
  const calmStep = !dismissed && active?.id === 'calm'

  useEffect(() => {
    if (activeId === 'hongkong' || activeId === 'seoul') {
      setUnlocked((u) => {
        if (activeId === 'hongkong' && !u.hongkong) return { ...u, hongkong: true }
        if (activeId === 'seoul' && !u.seoul) return { ...u, seoul: true }
        return u
      })
    }
  }, [activeId])

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
        calm: calmStep && !dismissed,
        overlays,
      }
    : null

  const jump = (id: string) => {
    if (id !== 'explore') setDismissed(false)
    // Unlock immediately on rail jump so overlays mount before scroll settles
    if (id === 'hongkong' || id === 'seoul') {
      setUnlocked((u) => ({ ...u, [id]: true }))
    }
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

  const showScrollCue =
    !dismissed &&
    active?.id !== 'explore' &&
    active?.id !== undefined

  const grainOn = Boolean(playingSound) && active?.id === 'sounds' && !dismissed
  const grainStrength = playingSound ? grainIntensity(playingSound.db) : 0

  useEffect(() => {
    if (active?.id !== 'sounds' || dismissed) setPlayingSound(null)
  }, [active?.id, dismissed])

  if (!metrics || !steps.length) {
    return (
      <main className="scrolly-root">
        <p className="scrolly-loading">Loading story…</p>
      </main>
    )
  }

  return (
    <main className={`scrolly-root${dismissed ? ' is-dismissed' : ''}${showScrollCue ? '' : ' is-explore'}`}>
      <ProgressRail steps={steps} activeId={active.id} onJump={jump} />

      <div className="scrolly-map-sticky">
        <NoiseMap story={mapControl} />
      </div>

      <SoundGrainOverlay active={grainOn} intensity={grainStrength} />

      <div className="scrolly-steps" aria-hidden={dismissed}>
        {steps.map((step) => {
          const isActiveCard = step.id === active.id && !dismissed
          return (
            <section
              key={step.id}
              className={`scrolly-step${step.id === 'hero' ? ' scrolly-step--hero' : ''}${step.id === 'sounds' ? ' scrolly-step--sounds' : ''}${step.id === 'calm' ? ' scrolly-step--calm' : ''}${isActiveCard ? ' is-active' : ''}`}
              data-step-id={step.id}
              ref={(el) => {
                stepRefs.current[step.id] = el
              }}
            >
              {!dismissed ? (
                <div className="scrolly-step__stack">
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
                    {step.subtitle ? (
                      <p className="scrolly-step__subtitle">{step.subtitle}</p>
                    ) : null}
                    {step.stats && step.stats.length > 0 ? (
                      <div
                        className="scrolly-step__stats"
                        role="list"
                        aria-label="Key noise impact figures"
                      >
                        {step.stats.map((stat) => (
                          <div
                            key={stat.value}
                            className="scrolly-step__stat"
                            role="listitem"
                          >
                            <div className="scrolly-step__stat-value">{stat.value}</div>
                            <div className="scrolly-step__stat-label">{stat.label}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {step.body.map((p) => (
                      <p
                        key={p.slice(0, 48)}
                        className="scrolly-step__body"
                        dangerouslySetInnerHTML={{
                          __html: p
                            .replace(
                              /\*\*\*(.+?)\*\*\*/g,
                              '<span class="scrolly-hi scrolly-hi--loud">$1</span>',
                            )
                            .replace(/\*\*(.+?)\*\*/g, '<span class="scrolly-hi">$1</span>')
                            .replace(/\n/g, '<br/>'),
                        }}
                      />
                    ))}
                    {step.id === 'sounds' ? (
                      <SoundScale
                        active={isActiveCard}
                        onPlayingChange={setPlayingSound}
                      />
                    ) : null}
                  </div>
                  {isActiveCard && step.id === 'hongkong' ? (
                    <div
                      className="scrolly-hk-colorbar"
                      aria-label="Hong Kong peak traffic noise color scale"
                    >
                      <div className="scrolly-hk-colorbar__ramp" />
                      <div className="scrolly-hk-colorbar__ticks">
                        <span>50 dB</span>
                        <span>peak traffic noise</span>
                        <span>85 dB</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>

      {showScrollCue ? (
        <div className="scrolly-scroll-cue" aria-hidden="true">
          <span className="scrolly-scroll-cue__label">Scroll</span>
          <span className="scrolly-scroll-cue__chevron" />
        </div>
      ) : null}
    </main>
  )
}
