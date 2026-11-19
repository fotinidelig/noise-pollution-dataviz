import { useEffect, useRef, useState, type CSSProperties } from 'react'
import './SoundGrainOverlay.css'

type Props = {
  /** Raw loudness ratio 2^((dB−ref)/10) — drives particle count (2× per +10 dB). */
  density: number
  /** 0–1 soft-ceiling for map dim / veil. */
  intensity: number
  active: boolean
}

const FADE_MS = 480

/** Full-screen particle grain; fades in/out via opacity + canvas alpha tween. */
export function SoundGrainOverlay({ density, intensity, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const densityRef = useRef(density)
  const fadeRef = useRef(0)
  const [mounted, setMounted] = useState(active)
  const [shown, setShown] = useState(false)

  densityRef.current = density

  // Mount for fade-in; keep mounted until fade-out CSS finishes.
  useEffect(() => {
    if (active) {
      setMounted(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
  }, [active])

  // Canvas alpha tween tracks shown state (same duration as CSS opacity).
  useEffect(() => {
    const start = performance.now()
    const from = fadeRef.current
    const to = shown ? 1 : 0
    let raf = 0
    const tick = (t: number) => {
      const u = Math.min(1, (t - start) / FADE_MS)
      // ease-in-out
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
      fadeRef.current = from + (to - from) * e
      if (u < 1) raf = requestAnimationFrame(tick)
      else fadeRef.current = to
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [shown])

  // Paint while mounted so fade-out still has live particles.
  useEffect(() => {
    if (!mounted) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let last = 0
    const paint = (t: number) => {
      // ~15 fps shimmer
      if (t - last < 66) {
        rafRef.current = requestAnimationFrame(paint)
        return
      }
      last = t
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      const cw = Math.floor(w * dpr)
      const ch = Math.floor(h * dpr)
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }

      ctx.clearRect(0, 0, cw, ch)

      const fade = fadeRef.current
      if (fade <= 0.001) {
        rafRef.current = requestAnimationFrame(paint)
        return
      }

      // Base particle count at dB_ref; doubles each +10 dB via density ratio
      const baseCount = 900
      const count = Math.min(
        28_000,
        Math.max(400, Math.round(baseCount * densityRef.current)),
      )

      // Bright particles on dark map — high contrast white/cyan flecks
      for (let i = 0; i < count; i++) {
        const x = Math.random() * cw
        const y = Math.random() * ch
        const size = (1 + Math.random() * 2.2) * dpr
        const bright = (0.72 + Math.random() * 0.28) * fade
        const cool = Math.random() > 0.65
        if (cool) {
          ctx.fillStyle = `rgba(210, 230, 240, ${bright})`
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${bright})`
        }
        ctx.fillRect(x, y, size, size)
      }

      rafRef.current = requestAnimationFrame(paint)
    }

    rafRef.current = requestAnimationFrame(paint)
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <div
      className={`sound-grain${shown ? ' is-visible' : ''}`}
      style={
        {
          '--grain-dim': String(0.4 + 0.4 * intensity),
          '--grain-fade-ms': `${FADE_MS}ms`,
        } as CSSProperties
      }
      aria-hidden="true"
      onTransitionEnd={(e) => {
        if (e.propertyName !== 'opacity') return
        if (!active && !shown) setMounted(false)
      }}
    >
      <div className="sound-grain__dim" />
      <canvas className="sound-grain__canvas" ref={canvasRef} />
    </div>
  )
}
