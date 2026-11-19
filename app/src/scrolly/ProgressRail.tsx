import { motion } from 'motion/react'
import type { StoryStep } from './storyTypes'
import { railTween } from './motionPresets'

type Props = {
  steps: StoryStep[]
  activeId: string
  /** Card is hidden — active stop click reopens it (label cue stays always-on). */
  cardHidden?: boolean
  onJump: (id: string) => void
}

export function ProgressRail({
  steps,
  activeId,
  cardHidden = false,
  onJump,
}: Props) {
  return (
    <nav className="scrolly-rail" aria-label="Story progress">
      <ol>
        {steps.map((s, i) => {
          const active = s.id === activeId
          const past = steps.findIndex((x) => x.id === activeId) > i
          const reopenCue = active && cardHidden
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`scrolly-rail__stop${active ? ' is-active' : ''}${past ? ' is-past' : ''}`}
                aria-current={active ? 'step' : undefined}
                aria-label={
                  reopenCue
                    ? `${s.railLabel} — show story card again`
                    : undefined
                }
                title={reopenCue ? 'Show story card' : undefined}
                onClick={() => onJump(s.id)}
              >
                <motion.span
                  className="scrolly-rail__dot"
                  animate={{ scale: active ? 1.25 : 1 }}
                  transition={railTween}
                />
                <span className="scrolly-rail__label">{s.railLabel}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
