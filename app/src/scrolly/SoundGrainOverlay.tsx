import { useEffect, useRef, type CSSProperties } from 'react'
import './SoundGrainOverlay.css'

type Props = {
  /** 0–1 soft-ceiling intensity from loudness ratio. */
  intensity: number
  active: boolean
}

/** Full-screen white-noise grain; only painted while a sample plays. */
export function SoundGrainOverlay({ intensity, active }: Props) {
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
      // ~12 fps — enough for grain shimmer without burning CPU
      if (t - last < 80) {
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
      const image = ctx.createImageData(cw, ch)
      const data = image.data
      // Sparse grain: every other pixel for speed; alpha from intensity
      const a = Math.round(55 + 160 * intensity)
      for (let i = 0; i < data.length; i += 8) {
        const v = (Math.random() * 255) | 0
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        data[i + 3] = a
      }
      ctx.putImageData(image, 0, 0)
      rafRef.current = requestAnimationFrame(paint)
    }

    rafRef.current = requestAnimationFrame(paint)
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [active, intensity])

  if (!active) return null

  return (
    <div
      className="sound-grain"
      style={
        {
          '--grain-opacity': String(0.22 + 0.55 * intensity),
          '--grain-dim': String(0.28 + 0.42 * intensity),
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div className="sound-grain__dim" />
      <canvas className="sound-grain__canvas" ref={canvasRef} />
    </div>
  )
}
