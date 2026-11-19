import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react'
import { DbWhiteNoise } from './dbWhiteNoise'
import './DbPlay.css'

export type DbPreview = {
  /** Stable id of the active DbPlay instance. */
  id: string
  db: number
}

type DbPlayContextValue = {
  /** When false (leave / Hide / jump), all previews must stop. */
  active: boolean
  preview: DbPreview | null
  /** Toggle this instance; starting one clears any other. */
  toggle: (id: string, db: number) => void
  stop: () => void
}

const DbPlayContext = createContext<DbPlayContextValue | null>(null)

type ProviderProps = {
  active: boolean
  preview: DbPreview | null
  onPreviewChange: (preview: DbPreview | null) => void
  children: ReactNode
}

/**
 * Shared story dB preview bus: one active level, white-noise + parent grain.
 * Clears on `active` false (leave / Hide / jump) — same discipline as SoundScale.
 */
export function DbPlayProvider({
  active,
  preview,
  onPreviewChange,
  children,
}: ProviderProps) {
  const previewRef = useRef(preview)
  const onChangeRef = useRef(onPreviewChange)
  const activeRef = useRef(active)
  const noiseRef = useRef<DbWhiteNoise | null>(null)
  previewRef.current = preview
  onChangeRef.current = onPreviewChange
  activeRef.current = active

  if (!noiseRef.current) noiseRef.current = new DbWhiteNoise()

  const stop = useCallback(() => {
    noiseRef.current?.stop()
    onChangeRef.current(null)
  }, [])

  const toggle = useCallback((id: string, db: number) => {
    if (!activeRef.current) return
    const cur = previewRef.current
    if (cur?.id === id) {
      noiseRef.current?.stop()
      onChangeRef.current(null)
      return
    }
    onChangeRef.current({ id, db })
  }, [])

  // Leave / Hide / Explore jump: hard-clear preview + audio.
  useEffect(() => {
    if (!active) {
      noiseRef.current?.stop()
      onChangeRef.current(null)
    }
  }, [active])

  // Drive white noise from the active preview (generation token inside DbWhiteNoise).
  useEffect(() => {
    const noise = noiseRef.current
    if (!noise) return
    if (!active || !preview) {
      noise.stop()
      return
    }
    void noise.play(preview.db)
  }, [active, preview])

  useEffect(() => {
    return () => {
      noiseRef.current?.stop()
      noiseRef.current = null
    }
  }, [])

  return (
    <DbPlayContext.Provider value={{ active, preview, toggle, stop }}>
      {children}
    </DbPlayContext.Provider>
  )
}

function useDbPlay() {
  const ctx = useContext(DbPlayContext)
  if (!ctx) {
    throw new Error('DbPlay must be used inside DbPlayProvider')
  }
  return ctx
}

type DbPlayProps = {
  db: number
  /** Magenta loudness styling (≥70 / vacuum territory). */
  loud?: boolean
  children: ReactNode
}

/**
 * Inline interactive dB figure. Click toggles SoundGrain + scaled white noise.
 */
export function DbPlay({ db, loud, children }: DbPlayProps) {
  const id = useId()
  const { active, preview, toggle } = useDbPlay()
  const playing = preview?.id === id
  const isLoud = loud ?? db >= 70

  return (
    <button
      type="button"
      className={`db-play scrolly-hi${isLoud ? ' scrolly-hi--loud' : ''}${playing ? ' is-playing' : ''}`}
      aria-pressed={playing}
      aria-label={
        playing
          ? `Stop ${db} decibel noise preview`
          : `Play ${db} decibel noise preview`
      }
      title={playing ? 'Click to stop' : 'Click to hear this level'}
      disabled={!active && !playing}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(id, db)
      }}
    >
      {children}
    </button>
  )
}
