import type { StoryStep } from './storyTypes'

type Props = {
  steps: StoryStep[]
  activeId: string
  onJump: (id: string) => void
}

export function ProgressRail({ steps, activeId, onJump }: Props) {
  return (
    <nav className="scrolly-rail" aria-label="Story progress">
      <ol>
        {steps.map((s, i) => {
          const active = s.id === activeId
          const past = steps.findIndex((x) => x.id === activeId) > i
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`scrolly-rail__stop${active ? ' is-active' : ''}${past ? ' is-past' : ''}`}
                aria-current={active ? 'step' : undefined}
                onClick={() => onJump(s.id)}
              >
                <span className="scrolly-rail__dot" />
                <span className="scrolly-rail__label">{s.railLabel}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
