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

/** Quietest → loudest story ladder (anchors from story-sound-samples.md). */
export const STORY_SOUND_ANCHORS: SoundAnchor[] = [
  {
    id: 'water',
    label: 'Water stream',
    db: 45,
    dbNote: '~40–50',
    src: `${BASE}audio/water-stream.mp3`,
  },
  {
    id: 'birds',
    label: 'Birds',
    db: 52,
    dbNote: '~44–60',
    src: `${BASE}audio/birds-singing.mp3`,
  },
  {
    id: 'vacuum',
    label: 'Vacuum',
    db: 70,
    dbNote: '~70',
    src: `${BASE}audio/vacuum-cleaner.mp3`,
    highlight: true,
  },
  {
    id: 'motorcycle',
    label: 'Motorcycle',
    db: 90,
    dbNote: '~90',
    src: `${BASE}audio/motorcycle-passing.mp3`,
  },
  {
    id: 'helicopter',
    label: 'Helicopter',
    db: 105,
    dbNote: '~105',
    src: `${BASE}audio/helicopter.mp3`,
  },
  {
    id: 'concert',
    label: 'Rock concert',
    db: 110,
    dbNote: '~90–130',
    src: `${BASE}audio/rock-concert.mp3`,
  },
]

type Props = {
  anchors?: SoundAnchor[]
}

export function SoundScale({ anchors = STORY_SOUND_ANCHORS }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const sorted = useMemo(
    () => [...anchors].sort((a, b) => a.db - b.db),
    [anchors],
  )

  useEffect(() => {
    return () => {
      const a = audioRef.current
      if (a) {
        a.pause()
        a.src = ''
      }
      audioRef.current = null
    }
  }, [])

  const play = async (anchor: SoundAnchor) => {
    let audio = audioRef.current
    if (!audio) {
      audio = new Audio()
      audioRef.current = audio
      audio.addEventListener('ended', () => setPlayingId(null))
    }
    if (playingId === anchor.id && !audio.paused) {
      audio.pause()
      audio.currentTime = 0
      setPlayingId(null)
      return
    }
    audio.pause()
    audio.src = anchor.src
    audio.currentTime = 0
    setPlayingId(anchor.id)
    try {
      await audio.play()
    } catch {
      setPlayingId(null)
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
            <span className="sound-scale__dot" />
            <span className="sound-scale__label">{a.label}</span>
            <span className="sound-scale__db">
              {a.dbNote ?? `~${a.db}`} dB
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
