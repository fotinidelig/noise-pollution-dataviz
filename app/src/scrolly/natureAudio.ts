import { loudnessRatio } from './SoundScale'

const BASE = import.meta.env.BASE_URL || '/'

/** Same loudness ref as grain / DbPlay white-noise. */
const REF_DB = 45
/**
 * Soft ceiling for quiet-place clips (calm scatter lives well below 90 dB).
 * Relative law still 2× per +10 dB from REF — same spirit as {@link whiteNoiseGain}.
 */
const PEAK_DB = 60
/** Comfortable max HTMLAudio volume at PEAK_DB. */
const MASTER = 0.85

export const NATURE_CLIPS = {
  birds: `${BASE}audio/birds-singing.mp3`,
  water: `${BASE}audio/water-stream.mp3`,
} as const

export type NatureClipId = keyof typeof NATURE_CLIPS

/** Day points → birds; night → water stream. */
export function natureClipForPeriod(period: 'day' | 'night'): NatureClipId {
  return period === 'day' ? 'birds' : 'water'
}

/**
 * Nature clip gain: 2× per +10 dB from 45, soft-capped at PEAK_DB → MASTER.
 * Same mapping spirit as DbPlay `whiteNoiseGain` (ratio / peak × master).
 */
export function natureGain(db: number): number {
  const ratio = loudnessRatio(db, REF_DB)
  const peak = loudnessRatio(PEAK_DB, REF_DB)
  return Math.min(1, ratio / peak) * MASTER
}

/**
 * Looping nature bed scaled by dB. Generation token: bump / stop so late
 * `play()` resolves cannot resume after leave / halt / switch.
 */
export class NatureClipPlayer {
  private audio: HTMLAudioElement | null = null
  private gen = 0

  stop() {
    this.gen += 1
    const a = this.audio
    if (!a) return
    a.pause()
    try {
      a.currentTime = 0
    } catch {
      /* ignore */
    }
    a.removeAttribute('src')
    a.load()
  }

  /** Start (or retarget) a looping nature clip at `db`. */
  async play(clip: NatureClipId, db: number): Promise<number> {
    this.stop()
    const gen = this.gen
    let audio = this.audio
    if (!audio) {
      audio = new Audio()
      audio.preload = 'auto'
      audio.loop = true
      this.audio = audio
    }
    audio.src = NATURE_CLIPS[clip]
    audio.volume = natureGain(db)
    try {
      audio.currentTime = 0
    } catch {
      /* ignore */
    }

    try {
      await audio.play()
    } catch {
      if (this.gen === gen) this.stop()
      return gen
    }

    // Leave / halt / switch won while awaiting play().
    if (this.gen !== gen) {
      audio.pause()
      try {
        audio.currentTime = 0
      } catch {
        /* ignore */
      }
      return gen
    }
    return gen
  }

  /** Retarget gain without restarting the clip. */
  setDb(db: number) {
    if (this.audio) this.audio.volume = natureGain(db)
  }

  dispose() {
    this.stop()
    this.audio = null
  }
}
