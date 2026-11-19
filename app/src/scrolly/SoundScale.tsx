import { useEffect, useMemo, useRef, useState } from 'react'
import './SoundScale.css'

export type SoundAnchor = {
  id: string
  label: string
  /** Displayed average / anchor dB. */
  db: number
  /** Short range hint under the label when useful. */
  dbNote?: string
  src: string
  /** Emphasize the HSD / vacuum threshold. */
  highlight?: boolean
}

const BASE = import.meta.env.BASE_URL || '/'

/** Quietest → loudest; scale ends near about 90 dB (motorcycle). */
export const STORY_SOUND_ANCHORS: SoundAnchor[] = [
  {
    id: 'water',
    label: 'Water stream',
    db: 45,
    dbNote: 'about 40–50',
    src: `${BASE}audio/water-stream.mp3`,
  },
  {
    id: 'birds',
    label: 'Birds',
    db: 52,
    dbNote: 'about 44–60',
    src: `${BASE}audio/birds-singing.mp3`,
  },
  {
    id: 'vacuum',
    label: 'Vacuum',
    db: 70,
    dbNote: 'about 70',
    src: `${BASE}audio/vacuum-cleaner.mp3`,
    highlight: true,
  },
  {
    id: 'blender',
    label: 'Blender',
    db: 85,
    dbNote: 'about 80–90',
    src: `${BASE}audio/blender.mp3`,
  },
  {
    id: 'motorcycle',
    label: 'Motorcycle',
    db: 90,
    dbNote: 'about 90',
    src: `${BASE}audio/freesound_community-motorcycle-77112.mp3`,
  },
]

/** Loudness ratio for grain density: 2× per +10 dB (ref ≈ quiet stream/birds). */
export function loudnessRatio(db: number, refDb = 45): number {
  return 2 ** ((db - refDb) / 10)
}

/** Soft-ceiling 0–1 for dim/veil strength (density uses {@link loudnessRatio}). */
export function grainIntensity(db: number, refDb = 45): number {
  const ratio = loudnessRatio(db, refDb)
  return 1 - Math.exp(-ratio / 5.5)
}

type Props = {
  anchors?: SoundAnchor[]
  /** When false (scrolled away / Hide / jump), stop playback and clear grain. */
  active?: boolean
  /** Silence clip audio only; keep playing UI + grain. */
  muted?: boolean
  /**
   * Bump to force-stop without leaving the step (e.g. body DbPlay took over).
   * Keeps buttons interactive so the user can switch back to a sample.
   */
  haltToken?: number
  /** Fired when playback starts/stops so the parent can show full-screen grain. */
  onPlayingChange?: (anchor: SoundAnchor | null) => void
}

/**
 * Click-to-play dB ladder. Leave / Hide / unmount must always win over an
 * in-flight `audio.play()` — a generation token invalidates stale starts.
 */
export function SoundScale({
  anchors = STORY_SOUND_ANCHORS,
  active = true,
  muted = false,
  haltToken = 0,
  onPlayingChange,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playGenRef = useRef(0)
  const activeRef = useRef(active)
  const mutedRef = useRef(muted)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const playingAnchorRef = useRef<SoundAnchor | null>(null)
  const sorted = useMemo(
    () => [...anchors].sort((a, b) => a.db - b.db),
    [anchors],
  )
  const onPlayingChangeRef = useRef(onPlayingChange)
  onPlayingChangeRef.current = onPlayingChange
  activeRef.current = active
  mutedRef.current = muted

  const hardStop = (opts?: { clearSrc?: boolean }) => {
    // Invalidate any in-flight play() so a late resolve cannot resume audio.
    playGenRef.current += 1
    const a = audioRef.current
    if (a) {
      a.pause()
      try {
        a.currentTime = 0
      } catch {
        /* ignore seek errors on empty/unready media */
      }
      if (opts?.clearSrc) {
        a.removeAttribute('src')
        a.load()
      }
    }
    playingAnchorRef.current = null
    setPlayingId(null)
    onPlayingChangeRef.current?.(null)
  }

  useEffect(() => {
    if (!active) hardStop()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop when leaving the sounds beat
  }, [active])

  useEffect(() => {
    if (haltToken > 0) hardStop()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent bumps token to yield to DbPlay
  }, [haltToken])

  // Mute: pause audio but keep playingId / grain. Unmute: resume the same clip.
  useEffect(() => {
    const audio = audioRef.current
    const anchor = playingAnchorRef.current
    if (!audio || !anchor || !activeRef.current) return
    if (muted) {
      audio.pause()
      return
    }
    playGenRef.current += 1
    const gen = playGenRef.current
    void audio.play().then(
      () => {
        if (playGenRef.current !== gen || !activeRef.current || mutedRef.current) {
          audio.pause()
        }
      },
      () => {
        /* autoplay / interrupted — leave UI state; user can click again */
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to mute flips
  }, [muted])

  useEffect(() => {
    return () => {
      // Unmount: bump gen + tear down media; skip React state updates.
      playGenRef.current += 1
      const a = audioRef.current
      if (a) {
        a.pause()
        try {
          a.currentTime = 0
        } catch {
          /* ignore */
        }
        a.removeAttribute('src')
        a.load()
      }
      audioRef.current = null
      playingAnchorRef.current = null
      onPlayingChangeRef.current?.(null)
    }
  }, [])

  const setPlaying = (anchor: SoundAnchor | null) => {
    playingAnchorRef.current = anchor
    setPlayingId(anchor?.id ?? null)
    onPlayingChangeRef.current?.(anchor)
  }

  const ensureAudio = () => {
    let audio = audioRef.current
    if (!audio) {
      audio = new Audio()
      audio.preload = 'auto'
      audioRef.current = audio
      audio.addEventListener('ended', () => {
        // Ignore ended from a superseded element / generation.
        if (!activeRef.current) return
        setPlaying(null)
      })
    }
    return audio
  }

  const play = async (anchor: SoundAnchor) => {
    if (!activeRef.current) return

    const audio = ensureAudio()

    // Toggle off the same clip (UI-playing even when muted / paused).
    if (playingId === anchor.id) {
      hardStop()
      return
    }

    // New clip: bump gen so any previous in-flight play is discarded.
    playGenRef.current += 1
    const gen = playGenRef.current

    audio.pause()
    audio.src = anchor.src
    try {
      audio.currentTime = 0
    } catch {
      /* ignore */
    }
    setPlaying(anchor)

    // Muted: keep grain / playing UI, skip audible start.
    if (mutedRef.current) return

    try {
      await audio.play()
    } catch {
      if (playGenRef.current === gen) setPlaying(null)
      return
    }

    // Leave / Hide / jump won the race — clear UI. Mute mid-start: keep grain.
    if (playGenRef.current !== gen || !activeRef.current) {
      audio.pause()
      try {
        audio.currentTime = 0
      } catch {
        /* ignore */
      }
      if (playGenRef.current === gen) setPlaying(null)
      return
    }
    if (mutedRef.current) {
      audio.pause()
    }
  }

  return (
    <div className="sound-scale" aria-label="Sound levels from quiet to loud">
      <div className="sound-scale__ends" aria-hidden="true">
        <span>quieter</span>
        <span>louder</span>
      </div>
      <div className="sound-scale__row" role="list">
        {sorted.map((a) => (
          <button
            key={a.id}
            type="button"
            role="listitem"
            className={`sound-scale__mark${a.highlight ? ' is-highlight' : ''}${playingId === a.id ? ' is-playing' : ''}`}
            onClick={() => void play(a)}
            aria-pressed={playingId === a.id}
            aria-label={`Play ${a.label}, about ${a.db} decibels`}
            title="Click to play sample"
          >
            <span className="sound-scale__pulse" aria-hidden="true">
              <span className="sound-scale__pulse-ring" />
              <span className="sound-scale__pulse-ring" />
              <span className="sound-scale__pulse-ring" />
              <span className="sound-scale__pulse-core" />
            </span>
            <span className="sound-scale__label">{a.label}</span>
            <span className="sound-scale__db">
              {a.dbNote ?? `about ${a.db}`} dB
            </span>
            <span className="sound-scale__play">
              {playingId === a.id ? 'playing' : 'play'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
