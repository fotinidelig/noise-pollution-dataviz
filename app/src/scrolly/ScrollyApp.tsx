import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  NoiseMap,
  type CalmScatterPreview,
  type StoryMapControl,
} from '../components/NoiseMap'
import { buildSteps } from './buildSteps'
import { DbPlayProvider, type DbPreview } from './DbPlay'
import { bobTween, cardFade, factFade } from './motionPresets'
import { ClickWaveOverlay } from './ClickWaveOverlay'
import { ProgressRail } from './ProgressRail'
import { renderStoryBody } from './renderStoryBody'
import { SoundGrainOverlay } from './SoundGrainOverlay'
import {
  SoundScale,
  grainIntensity,
  loudnessRatio,
  type SoundAnchor,
} from './SoundScale'
import type { StoryMetrics, StoryStepId } from './storyTypes'
import './scrolly.css'

const STORY_URL = `${import.meta.env.BASE_URL || '/'}data/scrolly_story_v1.json`

/**
 * Hide on each story card only fades the narrative box away. Map camera, zoom,
 * and Explore lock stay on the current beat. The active progress-rail stop keeps
 * its strong highlight so users know where they are; clicking that rail title
 * shows the card again (same beat; no jump to Explore).
 *
 * Hong Kong / Seoul overlays unlock when first visited and stay visible for the
 * rest of the story (including Explore) so scrolling back still shows the data.
 */
export function ScrollyApp() {
  const [metrics, setMetrics] = useState<StoryMetrics | null>(null)
  const [activeId, setActiveId] = useState<StoryStepId>('hero')
  const [cardHidden, setCardHidden] = useState(false)
  const [unlocked, setUnlocked] = useState({ hongkong: false, seoul: false })
  const [playingSound, setPlayingSound] = useState<SoundAnchor | null>(null)
  const [dbPreview, setDbPreview] = useState<DbPreview | null>(null)
  const [calmPreview, setCalmPreview] = useState<CalmScatterPreview | null>(
    null,
  )
  const [soundHaltToken, setSoundHaltToken] = useState(0)
  const [calmHaltToken, setCalmHaltToken] = useState(0)
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
  const active = steps.find((s) => s.id === activeId) ?? steps[0]

  // Unlock on the same render as the step (avoid one-frame race with map overlays)
  const overlays = useMemo(
    () => ({
      hongkong: unlocked.hongkong || activeId === 'hongkong',
      seoul: unlocked.seoul || activeId === 'seoul',
    }),
    [unlocked.hongkong, unlocked.seoul, activeId],
  )
  // Calm map mode follows the beat, not card visibility — Hide only fades the box.
  const calmStep = active?.id === 'calm'

  useEffect(() => {
    if (activeId === 'hongkong' || activeId === 'seoul') {
      setUnlocked((u) => {
        if (activeId === 'hongkong' && !u.hongkong) return { ...u, hongkong: true }
        if (activeId === 'seoul' && !u.seoul) return { ...u, seoul: true }
        return u
      })
    }
  }, [activeId])

  // New beat (scroll or jump) always shows its card again.
  useEffect(() => {
    setCardHidden(false)
  }, [activeId])

  useEffect(() => {
    if (!steps.length) return
    const nodes = steps
      .map((s) => stepRefs.current[s.id])
      .filter((n): n is HTMLElement => Boolean(n))
    if (!nodes.length) return

    // Activate as soon as a beat starts entering the upper half of the
    // viewport (not only when deeply centered), so the map flies in parallel
    // with reading the incoming card.
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
      {
        root: null,
        threshold: [0.05, 0.12, 0.22, 0.35, 0.5],
        rootMargin: '0px 0px -48% 0px',
      },
    )
    for (const n of nodes) obs.observe(n)
    return () => obs.disconnect()
  }, [steps])

  const onCalmPreviewChange = (next: CalmScatterPreview | null) => {
    setCalmPreview(next)
    // Mutual exclusion with story DbPlay / SoundScale.
    if (next) {
      setDbPreview(null)
      setPlayingSound(null)
      setSoundHaltToken((n) => n + 1)
    }
  }

  const mapControl: StoryMapControl | null = active?.map
    ? {
        center: active.map.center,
        zoom: active.map.zoom,
        source: active.map.source,
        metric: active.map.metric,
        highlightId: active.map.highlightId ?? null,
        // Hide only fades the story box — do not unlock Explore or retarget the camera.
        explore: Boolean(active.explore),
        stepId: active.id,
        calm: calmStep,
        overlays,
        calmScatterActive: calmStep,
        calmHaltToken,
        calmPreview,
        onCalmPreviewChange,
      }
    : null

  const jump = (id: string) => {
    if (id === activeId) {
      // Same stop: reopen if hidden; otherwise a no-op scroll is fine.
      setCardHidden(false)
      if (!cardHidden) {
        stepRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return
    }
    // Unlock immediately on rail jump so overlays mount before scroll settles
    if (id === 'hongkong' || id === 'seoul') {
      setUnlocked((u) => ({ ...u, [id]: true }))
    }
    const el = stepRefs.current[id]
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id as StoryStepId)
  }

  const hideCard = () => {
    setCardHidden(true)
  }

  // Facts: always-on grain at 75 dB (no DbPlay). Sounds / body DbPlay / calm scatter otherwise.
  const FACTS_GRAIN_DB = 75
  const factsGrain = active?.id === 'hero' && !cardHidden
  const dbPlayGrain = Boolean(dbPreview) && !cardHidden && active?.id !== 'hero'
  const soundsGrain =
    Boolean(playingSound) &&
    active?.id === 'sounds' &&
    !cardHidden &&
    !dbPreview &&
    !calmPreview
  const calmGrain = Boolean(calmPreview) && calmStep
  const grainOn = factsGrain || dbPlayGrain || soundsGrain || calmGrain
  const grainDb = factsGrain
    ? FACTS_GRAIN_DB
    : calmPreview?.db ?? dbPreview?.db ?? playingSound?.db
  const grainStrength = grainDb != null ? grainIntensity(grainDb) : 0
  const grainDensity = grainDb != null ? loudnessRatio(grainDb) : 1

  // Clear Sounds clips + body dB preview on step change / Hide / Explore jump.
  // SoundScale / DbPlayProvider also hard-stop via `active`.
  useEffect(() => {
    if (active?.id !== 'sounds' || cardHidden) setPlayingSound(null)
  }, [active?.id, cardHidden])

  // Any beat change or Hide tears down body dB preview (Facts never hosts one).
  useEffect(() => {
    setDbPreview(null)
  }, [active?.id, cardHidden])

  // Calm scatter nature preview lives on the map chart — stop only when leaving calm.
  useEffect(() => {
    if (!calmStep) setCalmPreview(null)
  }, [calmStep])

  const onDbPreviewChange = (next: DbPreview | null) => {
    setDbPreview(next)
    // Mutual exclusion with SoundScale samples + calm scatter (keep them clickable).
    if (next) {
      setPlayingSound(null)
      setSoundHaltToken((n) => n + 1)
      setCalmPreview(null)
      setCalmHaltToken((n) => n + 1)
    }
  }

  const onSoundPlayingChange = (anchor: SoundAnchor | null) => {
    setPlayingSound(anchor)
    if (anchor) {
      setDbPreview(null)
      setCalmPreview(null)
      setCalmHaltToken((n) => n + 1)
    }
  }

  // Facts has no DbPlay; elsewhere stop on Hide / leave via active=false.
  const dbPlayActive = !cardHidden && active?.id !== 'hero'
  const soundScaleActive = activeId === 'sounds' && !cardHidden

  if (!metrics || !steps.length) {
    return (
      <main className="scrolly-root">
        <p className="scrolly-loading">Loading story…</p>
      </main>
    )
  }

  return (
    <main className={`scrolly-root${cardHidden ? ' is-card-hidden' : ''}`}>
      <DbPlayProvider
        active={dbPlayActive}
        preview={dbPreview}
        onPreviewChange={onDbPreviewChange}
      >
      <ClickWaveOverlay />
      <ProgressRail
        steps={steps}
        activeId={active.id}
        cardHidden={cardHidden}
        onJump={jump}
      />

      <div className="scrolly-map-sticky">
        <NoiseMap story={mapControl} />
      </div>

      <SoundGrainOverlay
        active={grainOn}
        intensity={grainStrength}
        density={grainDensity}
      />

      <div className="scrolly-steps" aria-hidden={cardHidden}>
        {steps.map((step, index) => {
          const isActiveCard = step.id === active.id && !cardHidden
          const prevStep = index > 0 ? steps[index - 1] : null
          const nextStep = steps[index + 1]
          const isActiveHidden = step.id === active.id && cardHidden
          return (
            <section
              key={step.id}
              className={`scrolly-step${step.id === 'hero' ? ' scrolly-step--hero' : ''}${step.id === 'birds' ? ' scrolly-step--intro' : ''}${step.id === 'sounds' ? ' scrolly-step--sounds' : ''}${step.id === 'calm' ? ' scrolly-step--calm' : ''}${isActiveCard ? ' is-active' : ''}${isActiveHidden ? ' is-card-hidden' : ''}`}
              data-step-id={step.id}
              ref={(el) => {
                stepRefs.current[step.id] = el
              }}
            >
              <motion.div
                className={`scrolly-step__stack${
                  step.id === 'hero' && step.stats?.length
                    ? ' scrolly-step__stack--facts'
                    : ''
                }`}
                initial={false}
                animate={
                  cardHidden && step.id === active.id
                    ? { opacity: 0, y: 6 }
                    : { opacity: 1, y: 0 }
                }
                transition={cardFade}
                style={{
                  pointerEvents:
                    cardHidden && step.id === active.id ? 'none' : undefined,
                  visibility:
                    cardHidden && step.id === active.id ? 'hidden' : undefined,
                }}
              >
                {step.id === 'hero' && step.stats && step.stats.length > 0 ? (
                  <div className="scrolly-step__facts-panel">
                    <div
                      className="scrolly-step__facts"
                      role="list"
                      aria-label="Key noise impact figures"
                    >
                      {step.stats.map((stat, i) => (
                        <motion.div
                          key={stat.value}
                          className="scrolly-step__fact-box"
                          role="listitem"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...factFade, delay: i * 0.05 }}
                        >
                          {stat.prefix ? (
                            <div className="scrolly-step__stat-prefix">
                              {stat.prefix}
                            </div>
                          ) : null}
                          <div className="scrolly-step__stat-value">
                            {stat.value}
                          </div>
                          <div className="scrolly-step__stat-label">
                            {stat.label}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    {nextStep ? (
                      <button
                        type="button"
                        className="scrolly-step__next"
                        aria-label={`Next story: ${nextStep.title}`}
                        title={`Next: ${nextStep.railLabel}`}
                        onClick={() => jump(nextStep.id)}
                      >
                        <motion.span
                          className="scrolly-step__chevron-bob"
                          aria-hidden="true"
                          animate={{ y: [0, 6, 0] }}
                          transition={bobTween}
                        >
                          <span className="scrolly-step__next-chevron" />
                        </motion.span>
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="scrolly-step__card-shell">
                    {/* Sibling behind the card — not a card child */}
                    {step.id === 'birds' ? (
                      <span
                        className="scrolly-step__corner-wave scrolly-step__corner-wave--intro"
                        aria-hidden="true"
                      >
                        {/* dB band palette: quiet → loud */}
                        <span className="scrolly-step__corner-wave-ring" />
                        <span className="scrolly-step__corner-wave-ring" />
                        <span className="scrolly-step__corner-wave-ring" />
                        <span className="scrolly-step__corner-wave-ring" />
                        <span className="scrolly-step__corner-wave-ring" />
                      </span>
                    ) : (
                      <span
                        className="scrolly-step__corner-wave"
                        aria-hidden="true"
                      >
                        <span className="scrolly-step__corner-wave-ring" />
                        <span className="scrolly-step__corner-wave-ring" />
                        <span className="scrolly-step__corner-wave-ring" />
                      </span>
                    )}
                    <div className="scrolly-step__card">
                      <button
                        type="button"
                        className="scrolly-step__hide"
                        aria-label="Hide story card"
                        title="Hide story card"
                        onClick={hideCard}
                      >
                        Hide
                      </button>
                      {prevStep ? (
                        <button
                          type="button"
                          className="scrolly-step__prev"
                          aria-label={`Previous story: ${prevStep.title}`}
                          title={`Previous: ${prevStep.railLabel}`}
                          onClick={() => jump(prevStep.id)}
                        >
                          <motion.span
                            className="scrolly-step__chevron-bob"
                            aria-hidden="true"
                            animate={{ y: [0, -6, 0] }}
                            transition={bobTween}
                          >
                            <span className="scrolly-step__prev-chevron" />
                          </motion.span>
                        </button>
                      ) : null}
                      {step.year != null ? (
                        <p className="scrolly-step__year">Year {step.year}</p>
                      ) : null}
                      <h2 className="scrolly-step__title">{step.title}</h2>
                      {step.subtitle ? (
                        <p className="scrolly-step__subtitle">{step.subtitle}</p>
                      ) : null}
                      {step.id === 'sounds' ? (
                        <>
                          {step.body[0] ? (
                            <p className="scrolly-step__body">
                              {renderStoryBody(step.body[0])}
                            </p>
                          ) : null}
                          <SoundScale
                            active={soundScaleActive}
                            haltToken={soundHaltToken}
                            onPlayingChange={onSoundPlayingChange}
                          />
                          {step.body.slice(1).map((p) => (
                            <p key={p.slice(0, 48)} className="scrolly-step__body">
                              {renderStoryBody(p)}
                            </p>
                          ))}
                        </>
                      ) : (
                        step.body.map((p) => (
                          <p key={p.slice(0, 48)} className="scrolly-step__body">
                            {renderStoryBody(p)}
                          </p>
                        ))
                      )}
                      {nextStep ? (
                        <button
                          type="button"
                          className="scrolly-step__next"
                          aria-label={`Next story: ${nextStep.title}`}
                          title={`Next: ${nextStep.railLabel}`}
                          onClick={() => jump(nextStep.id)}
                        >
                          <motion.span
                            className="scrolly-step__chevron-bob"
                            aria-hidden="true"
                            animate={{ y: [0, 6, 0] }}
                            transition={bobTween}
                          >
                            <span className="scrolly-step__next-chevron" />
                          </motion.span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
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
              </motion.div>
            </section>
          )
        })}
      </div>
      </DbPlayProvider>
    </main>
  )
}
