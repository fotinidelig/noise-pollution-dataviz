import { useEffect, useRef, type CSSProperties } from 'react'
import './SoundGrainOverlay.css'

type Props = {
  /** Raw loudness ratio 2^((dB−ref)/10) — drives particle count (2× per +10 dB). */
  density: number
  /** 0–1 soft-ceiling for map dim / veil. */
  intensity: number
  active: boolean
}

/** Full-screen visible particle grain; only while a sample plays. */
export function SoundGrainOverlay({ density, intensity, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

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

      // Base particle count at dB_ref; doubles each +10 dB via density ratio
      const baseCount = 900
      const count = Math.min(
        28_000,
        Math.max(400, Math.round(baseCount * density)),
      )

      // Bright particles on dark map — high contrast white/cyan flecks
      for (let i = 0; i < count; i++) {
        const x = Math.random() * cw
        const y = Math.random() * ch
        const size = (1 + Math.random() * 2.2) * dpr
        const bright = 0.72 + Math.random() * 0.28
        // Slight cool tint so flecks read on dark basemap
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
  }, [active, density])

  if (!active) return null

  return (
    <div
      className="sound-grain"
      style={
        {
          '--grain-dim': String(0.4 + 0.4 * intensity),
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div className="sound-grain__dim" />
      <canvas className="sound-grain__canvas" ref={canvasRef} />
    </div>
  )
}
