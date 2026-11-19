import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { LDEN_BANDS } from '../lib/noiseStyle'
import './ClickWaveOverlay.css'

type Pulse = { id: number; x: number; y: number; color: string }

const BAND_COLORS = LDEN_BANDS.map((b) => b.color)
const PULSE_MS = 820

/**
 * Spawns a small sound-wave pulse at the pointer on every primary click.
 * Decorative only — pointer-events none; respects prefers-reduced-motion.
 */
export function ClickWaveOverlay() {
  const [pulses, setPulses] = useState<Pulse[]>([])
  const nextId = useRef(0)
  const colorIdx = useRef(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduced.matches) return

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const id = nextId.current++
      const color = BAND_COLORS[colorIdx.current++ % BAND_COLORS.length]!
      setPulses((prev) => [...prev, { id, x: e.clientX, y: e.clientY, color }])
      window.setTimeout(() => {
        setPulses((prev) => prev.filter((p) => p.id !== id))
      }, PULSE_MS)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  if (pulses.length === 0) return null

  return (
    <div className="click-wave-overlay" aria-hidden="true">
      {pulses.map((p) => (
        <span
          key={p.id}
          className="click-wave"
          style={
            {
              left: p.x,
              top: p.y,
              '--cw-color': p.color,
            } as CSSProperties
          }
        >
          <span className="click-wave__ring" />
          <span className="click-wave__ring" />
          <span className="click-wave__ring" />
        </span>
      ))}
    </div>
  )
}
