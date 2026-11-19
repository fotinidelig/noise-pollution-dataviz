import type { ReactNode } from 'react'
import { DbPlay } from './DbPlay'

/**
 * Marker written by buildSteps `dbPlay()`:
 * ⟦db:<level>:<0|1 loud>:<label>⟧
 */
const DB_PLAY_RE = /⟦db:(-?[\d.]+):([01]):([^⟧]+)⟧/g

function highlightHtml(text: string): string {
  return text
    .replace(
      /\*\*\*(.+?)\*\*\*/g,
      '<span class="scrolly-hi scrolly-hi--loud">$1</span>',
    )
    .replace(/\*\*(.+?)\*\*/g, '<span class="scrolly-hi">$1</span>')
    .replace(/\n/g, '<br/>')
}

/**
 * Turn a story body string (hi / hiLoud / dbPlay markers) into React nodes
 * with interactive {@link DbPlay} spans where dB levels appear.
 */
export function renderStoryBody(paragraph: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  DB_PLAY_RE.lastIndex = 0

  while ((match = DB_PLAY_RE.exec(paragraph)) !== null) {
    if (match.index > last) {
      const html = highlightHtml(paragraph.slice(last, match.index))
      nodes.push(
        <span
          key={`t-${key++}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />,
      )
    }
    const db = Number(match[1])
    const loud = match[2] === '1'
    const label = match[3]
    nodes.push(
      <DbPlay key={`d-${key++}`} db={db} loud={loud}>
        {label}
      </DbPlay>,
    )
    last = match.index + match[0].length
  }

  if (last < paragraph.length || nodes.length === 0) {
    const html = highlightHtml(paragraph.slice(last))
    nodes.push(
      <span key={`t-${key++}`} dangerouslySetInnerHTML={{ __html: html }} />,
    )
  }

  return nodes
}
