/**
 * My Moonbase share image and share plumbing (client-only).
 *
 * As with the games, the image is the post: X plays down links, so the card
 * carries a picture of the base, its name and the address printed on it. The
 * link in the post opens the base itself.
 */
import { canvasToBlob, xIntentUrl } from '@/lib/touchdown/share'
import { DEFAULT_BASE_NAME } from './grid'
import { BASE_SHARE_URL_LABEL, publicBaseName } from './share'

export { canvasToBlob, xIntentUrl }

export const CARD_W = 1200
export const CARD_H = 675

function fitText(g: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (g.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && g.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

/** Compose the 1200×675 share card over a frame captured from the plot. */
export function composeBaseCard(args: {
  frame: HTMLCanvasElement
  name: string
  /** One line under the name, such as "8 of 11 races predicted". */
  detail: string
}): HTMLCanvasElement {
  const { frame } = args
  const c = document.createElement('canvas')
  c.width = CARD_W
  c.height = CARD_H
  const g = c.getContext('2d')!

  const scale = Math.max(CARD_W / frame.width, CARD_H / frame.height)
  const dw = frame.width * scale
  const dh = frame.height * scale
  g.fillStyle = '#000'
  g.fillRect(0, 0, CARD_W, CARD_H)
  g.drawImage(frame, (CARD_W - dw) / 2, (CARD_H - dh) / 2, dw, dh)

  const top = g.createLinearGradient(0, 0, 0, 170)
  top.addColorStop(0, 'rgba(0,0,0,0.7)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = top
  g.fillRect(0, 0, CARD_W, 170)
  const bottom = g.createLinearGradient(0, CARD_H - 260, 0, CARD_H)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(0.55, 'rgba(0,0,0,0.72)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.92)')
  g.fillStyle = bottom
  g.fillRect(0, CARD_H - 260, CARD_W, 260)

  const head = '"Archivo", "Lato", system-ui, sans-serif'
  const body = '"Lato", system-ui, sans-serif'
  g.textBaseline = 'alphabetic'

  g.fillStyle = '#fff'
  g.font = `800 34px ${head}`
  g.fillText('MY MOONBASE', 48, 70)
  const brandW = g.measureText('MY MOONBASE').width
  g.font = `600 22px ${body}`
  g.fillStyle = 'rgba(255,255,255,0.75)'
  g.fillText('Built from my predictions', 48 + brandW + 18, 68)

  const name = publicBaseName(args.name)
  g.fillStyle = '#fff'
  g.font = `800 72px ${head}`
  // The default name is the brand line again. The detail carries the card then.
  if (name !== DEFAULT_BASE_NAME) g.fillText(fitText(g, name, CARD_W - 96), 46, CARD_H - 104)

  g.font = `600 26px ${body}`
  g.fillStyle = 'rgba(255,255,255,0.86)'
  g.fillText(fitText(g, args.detail, CARD_W - 96 - 320), 48, CARD_H - 46)
  g.textAlign = 'right'
  g.font = `700 24px ${body}`
  g.fillStyle = '#fff'
  g.fillText(BASE_SHARE_URL_LABEL, CARD_W - 48, CARD_H - 46)
  g.textAlign = 'left'
  return c
}

export type BaseShareResult =
  /** The system share sheet took it. */
  | 'sheet'
  /** The image is on the clipboard and the X composer is open. */
  | 'clipboard'
  /** The X composer is open with the text and the link only. */
  | 'composer'
  | 'cancelled'

/**
 * Share the base. Must be called directly from a click or tap with the image
 * already prepared, so the share sheet, the popup and the clipboard write all
 * run inside the user gesture. Touch: the system share sheet. Desktop: copy
 * the image and open the X composer, where it can be pasted.
 */
export async function shareBase(args: {
  blob: Blob | null
  text: string
  url: string
  preferSheet: boolean
}): Promise<BaseShareResult> {
  const { blob, text, url, preferSheet } = args
  if (preferSheet && typeof navigator !== 'undefined' && navigator.share) {
    const file = blob ? new File([blob], 'my-moonbase.png', { type: 'image/png' }) : null
    const attach = !!file && (!navigator.canShare || navigator.canShare({ files: [file] }))
    try {
      await navigator.share(attach ? { files: [file!], text: `${text} ${url}` } : { text, url })
      return 'sheet'
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }
  if (blob && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    // Start the write while this page still has focus, then open the composer.
    let write: Promise<void>
    try {
      write = navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    } catch {
      write = Promise.reject(new Error('clipboard unavailable'))
    }
    window.open(xIntentUrl(text, url), '_blank', 'noopener')
    try {
      await write
      return 'clipboard'
    } catch {
      return 'composer'
    }
  }
  window.open(xIntentUrl(text, url), '_blank', 'noopener')
  return 'composer'
}
