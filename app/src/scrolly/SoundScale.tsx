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
    src: `${BASE}audio/motorcycle-passing.mp3`,
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
  /** When false (scrolled away), stop playback and clear grain. */
  active?: boolean
  /** Fired when playback starts/stops so the parent can show full-screen grain. */
  onPlayingChange?: (anchor: SoundAnchor | null) => void
}

export function SoundScale({
  anchors = STORY_SOUND_ANCHORS,
  active = true,
  onPlayingChange,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const sorted = useMemo(
    () => [...anchors].sort((a, b) => a.db - b.db),
    [anchors],
  )
  const onPlayingChangeRef = useRef(onPlayingChange)
  onPlayingChangeRef.current = onPlayingChange

  const stop = () => {
    const a = audioRef.current
    if (a) {
      a.pause()
      a.currentTime = 0
    }
    setPlayingId(null)
    onPlayingChangeRef.current?.(null)
  }

  useEffect(() => {
    if (!active) stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop when leaving the sounds beat
  }, [active])

  useEffect(() => {
    return () => {
      const a = audioRef.current
      if (a) {
        a.pause()
        a.src = ''
      }
      audioRef.current = null
      onPlayingChangeRef.current?.(null)
    }
  }, [])

  const setPlaying = (anchor: SoundAnchor | null) => {
    setPlayingId(anchor?.id ?? null)
    onPlayingChangeRef.current?.(anchor)
  }

  const play = async (anchor: SoundAnchor) => {
    let audio = audioRef.current
    if (!audio) {
      audio = new Audio()
      audioRef.current = audio
      audio.addEventListener('ended', () => setPlaying(null))
    }
    if (playingId === anchor.id && !audio.paused) {
      audio.pause()
      audio.currentTime = 0
      setPlaying(null)
      return
    }
    audio.pause()
    audio.src = anchor.src
    audio.currentTime = 0
    setPlaying(anchor)
    try {
      await audio.play()
    } catch {
      setPlaying(null)
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
      <p className="sound-scale__note">
        Samples show character, not calibrated loudness on your device.
      </p>
    </div>
  )
}
