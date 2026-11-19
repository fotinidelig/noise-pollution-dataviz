import { loudnessRatio } from './SoundScale'

/** Same loudness ref as grain (quiet stream / birds). */
const REF_DB = 45
/** Peak-normalize so this level maps to MASTER gain (avoids clipping at 90+). */
const PEAK_DB = 90
/** Comfortable max linear gain at PEAK_DB. */
const MASTER = 0.16
const NOISE_SECONDS = 1.5

export function whiteNoiseGain(db: number): number {
  const ratio = loudnessRatio(db, REF_DB)
  const peak = loudnessRatio(PEAK_DB, REF_DB)
  return Math.min(1, ratio / peak) * MASTER
}

type NoiseHandle = {
  ctx: AudioContext
  source: AudioBufferSourceNode
  gain: GainNode
}

function buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS))
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  // Peak-normalize the buffer itself so gainForDb alone sets loudness.
  let peak = 0
  for (let i = 0; i < frames; i++) {
    const s = Math.random() * 2 - 1
    data[i] = s
    const a = Math.abs(s)
    if (a > peak) peak = a
  }
  if (peak > 0) {
    const inv = 1 / peak
    for (let i = 0; i < frames; i++) data[i] *= inv
  }
  return buffer
}

/**
 * Looping white-noise bed scaled by dB (2× per +10 dB, soft-capped).
 * Generation token: bump `gen` / call stop so late starts cannot resume.
 */
export class DbWhiteNoise {
  private handle: NoiseHandle | null = null
  private gen = 0

  /** Invalidate in-flight starts and tear down audio. */
  stop() {
    this.gen += 1
    const h = this.handle
    this.handle = null
    if (!h) return
    try {
      h.source.stop()
    } catch {
      /* already stopped */
    }
    try {
      h.source.disconnect()
      h.gain.disconnect()
    } catch {
      /* ignore */
    }
    void h.ctx.close().catch(() => undefined)
  }

  /** Start (or retarget) noise at `db`. Returns the generation used. */
  async play(db: number): Promise<number> {
    this.stop()
    const gen = this.gen
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const ctx = new Ctx()
    const gain = ctx.createGain()
    gain.gain.value = whiteNoiseGain(db)
    const source = ctx.createBufferSource()
    source.buffer = buildNoiseBuffer(ctx)
    source.loop = true
    source.connect(gain)
    gain.connect(ctx.destination)
    this.handle = { ctx, source, gain }

    try {
      if (ctx.state === 'suspended') await ctx.resume()
    } catch {
      if (this.gen === gen) this.stop()
      return gen
    }

    // Leave / Hide / switch won while awaiting resume.
    if (this.gen !== gen) {
      try {
        source.stop()
      } catch {
        /* ignore */
      }
      void ctx.close().catch(() => undefined)
      return gen
    }

    try {
      source.start(0)
    } catch {
      if (this.gen === gen) this.stop()
    }
    return gen
  }

  /** Retarget gain without rebuilding the buffer (same gen). */
  setDb(db: number) {
    if (this.handle) this.handle.gain.gain.value = whiteNoiseGain(db)
  }
}
