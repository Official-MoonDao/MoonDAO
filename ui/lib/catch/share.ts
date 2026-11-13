/**
 * Starship Catch share card and share plumbing (client-only).
 *
 * The image is the post: X suppresses links, so the card carries the end shot,
 * score, verdict and the URL printed on it. Challenge links, the clipboard and
 * canvas helpers are the same as Touchdown's and are shared unchanged.
 */
import {
  canvasToBlob,
  challengeQuery,
  cleanNickname,
  copyImage,
  parseChallenge,
  xIntentUrl,
  type Challenge,
  type ShareMethod,
} from '@/lib/touchdown/share'
import type { FlightResult } from './scoring'
import { bragLine, formatScore, outcomeHeadline, worstDamage } from './verdicts'

export { canvasToBlob, challengeQuery, cleanNickname, copyImage, parseChallenge, xIntentUrl }
export type { Challenge, ShareMethod }

export const SHARE_PATH = '/starship'
export const SHARE_URL_LABEL = 'moondao.com/starship'
export const CARD_W = 1200
export const CARD_H = 675

const DARE = 'Catching Starship is HARD. See if you can do it? 🚀'

const DAMAGE_POST: Record<string, string> = {
  tankfarm: '🔥 I missed the catch and landed a Starship on the tank farm.',
  booster: '💥 I missed the catch and hit the booster next door. Two for one.',
  tower2: '💥 I flew a Starship into the wrong tower.',
  tower: '💥 I flew a Starship straight into the launch tower.',
  hopper: '😭 I crashed a Starship into the old hopper. The hopper!',
  mount: '💥 Missed the arms. Found the launch mount.',
  mount2: '💥 Missed the arms. Found the other launch pad.',
  arms: '😬 I landed a Starship ON the catch arms instead of in them.',
  plant: '💥 I parked a Starship in the ground equipment.',
  highway: '🚧 I closed Highway 4 with a Starship.',
}

/** Prefilled post text: what happened, the numbers people quote, and the dare. */
export function shareText(result: FlightResult, rank?: number): string {
  const pro = result.mode === 'pro' ? ' (PRO 🏅)' : ''
  const place = rank ? ` · #${rank} today 🏆` : ''
  const score = `${formatScore(result.score)} pts${pro}${place}`
  let lines: string[]
  switch (result.outcome) {
    case 'caught':
      lines = result.hard
        ? ['😅 Caught a Starship... by its flaps. It counts.', score]
        : ['🥢 I caught a Starship out of the sky with the tower arms.', `${score} · ${result.closingSpeed.toFixed(1)} m/s onto the arms`]
      break
    case 'splashdown':
      lines = ['🌊 Soft landing! In the Gulf. I flew right past the tower.', score]
      break
    case 'ditched':
      lines = ['🫠 Landed a Starship gently on the ground. It has no legs. It fell over.', score]
      break
    case 'lost':
      lines = ['🛰️ I lost an entire Starship. 😭', `${formatScore(result.score)} pts${pro}`]
      break
    default: {
      const worst = worstDamage(result)
      lines = [worst ? DAMAGE_POST[worst] : '💥 RUD. I just turned a Starship into a very large fireball.', `${score}${result.damage.length > 1 ? ` · ${result.damage.length} structures hit` : ''}`]
    }
  }
  // The very best and the very worst flights get a tag; a middling crash sometimes apologizes.
  const max = result.mode === 'pro' ? 1375 : 1100
  if (result.outcome === 'caught' && !result.hard && result.score >= max * 0.86) lines.push('@elonmusk would be proud.')
  else if (result.score <= -500) lines.push('@elonmusk is NOT happy.')
  else if (result.outcome === 'crashed' && result.damage.length > 0 && Math.abs(result.score) % 3 === 0) lines.push('Sorry, @SpaceX.')
  else if (result.outcome === 'crashed' || result.outcome === 'ditched') lines.push('Excitement guaranteed.')
  return [...lines, '', DARE].join('\n')
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = next
  }
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Compose the 1200×675 share card over a captured end-shot frame. */
export function composeCard(args: { frame: HTMLCanvasElement; result: FlightResult; verdict: string; nickname?: string; rank?: number }): HTMLCanvasElement {
  const { frame, result, verdict } = args
  const c = document.createElement('canvas')
  c.width = CARD_W
  c.height = CARD_H
  const g = c.getContext('2d')!
  const scale = Math.max(CARD_W / frame.width, CARD_H / frame.height)
  const dw = frame.width * scale
  const dh = frame.height * scale
  g.fillStyle = '#000'
  g.fillRect(0, 0, CARD_W, CARD_H)
  g.drawImage(frame, (CARD_W - dw) / 2, (CARD_H - dh) * 0.5, dw, dh)

  const top = g.createLinearGradient(0, 0, 0, 170)
  top.addColorStop(0, 'rgba(0,0,0,0.7)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = top
  g.fillRect(0, 0, CARD_W, 170)
  const bottom = g.createLinearGradient(0, CARD_H - 300, 0, CARD_H)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(0.55, 'rgba(0,0,0,0.72)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.92)')
  g.fillStyle = bottom
  g.fillRect(0, CARD_H - 300, CARD_W, 300)

  const head = '"Archivo", "Lato", system-ui, sans-serif'
  const body = '"Lato", system-ui, sans-serif'
  g.textBaseline = 'alphabetic'

  g.fillStyle = '#fff'
  g.font = `800 34px ${head}`
  g.fillText('STARSHIP CATCH', 48, 70)
  const brandW = g.measureText('STARSHIP CATCH').width
  if (result.mode === 'pro') {
    const x = 48 + brandW + 22
    g.fillStyle = '#ffd34d'
    roundRect(g, x, 38, 96, 42, 8)
    g.fill()
    g.fillStyle = '#111'
    g.font = `800 24px ${head}`
    g.textAlign = 'center'
    g.fillText('PRO', x + 48, 68)
    g.textAlign = 'left'
  }

  const good = result.outcome === 'caught'
  g.font = `800 26px ${head}`
  g.fillStyle = good ? (result.hard ? '#ffd34d' : '#7dffb0') : '#ff8a6b'
  g.fillText(outcomeHeadline(result).toUpperCase(), 48, CARD_H - 196)

  g.fillStyle = '#fff'
  g.font = `800 104px ${head}`
  const scoreText = formatScore(result.score)
  g.fillText(scoreText, 44, CARD_H - 100)
  const scoreW = g.measureText(scoreText).width
  g.font = `600 24px ${body}`
  g.fillStyle = 'rgba(255,255,255,0.7)'
  g.fillText('pts', 44 + scoreW + 12, CARD_H - 102)

  g.font = `600 30px ${body}`
  g.fillStyle = '#fff'
  const textX = Math.max(360, 44 + scoreW + 90)
  const lines = wrap(g, verdict, CARD_W - textX - 48, 3)
  const startY = CARD_H - 112 - (lines.length - 1) * 38
  lines.forEach((line, i) => g.fillText(line, textX, startY + i * 38))

  g.font = `600 22px ${body}`
  g.fillStyle = 'rgba(255,255,255,0.82)'
  const nick = cleanNickname(args.nickname)
  const place = args.rank ? `#${args.rank} today · ` : ''
  g.fillText(`${nick ? `${nick} · ` : ''}${place}${bragLine(result)}`, 48, CARD_H - 44)
  g.textAlign = 'right'
  g.font = `700 24px ${body}`
  g.fillStyle = '#fff'
  g.fillText(SHARE_URL_LABEL, CARD_W - 48, CARD_H - 44)
  g.textAlign = 'left'
  return c
}

/** Stamp a player photo with a small credit, bottom-right. Returns the same canvas. */
export function stampPhoto(photo: HTMLCanvasElement): HTMLCanvasElement {
  const g = photo.getContext('2d')
  if (!g) return photo
  const s = Math.max(photo.width, photo.height) / 1600
  g.textBaseline = 'alphabetic'
  g.textAlign = 'right'
  g.shadowColor = 'rgba(0,0,0,0.8)'
  g.shadowBlur = 8 * s
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.font = `800 ${Math.round(26 * s)}px "Archivo", "Lato", system-ui, sans-serif`
  g.fillText('STARSHIP CATCH', photo.width - 28 * s, photo.height - 54 * s)
  g.font = `700 ${Math.round(20 * s)}px "Lato", system-ui, sans-serif`
  g.fillText(SHARE_URL_LABEL, photo.width - 28 * s, photo.height - 26 * s)
  g.shadowBlur = 0
  g.textAlign = 'left'
  return photo
}

/**
 * Share the card. Must be called directly from a click or tap with the blob
 * already prepared, so the share sheet, popup and clipboard write all run
 * inside the user gesture. Touch: the system share sheet with the PNG. Desktop:
 * copy the PNG and open the X composer. Otherwise 'fallback': the caller shows
 * the image to save plus the X link.
 */
export async function shareCard(args: { blob: Blob | null; text: string; url: string; preferSheet: boolean }): Promise<ShareMethod | 'cancelled'> {
  const { blob, text, url, preferSheet } = args
  if (blob && preferSheet && typeof navigator !== 'undefined' && navigator.share) {
    const file = new File([blob], 'catch.png', { type: 'image/png' })
    if (!navigator.canShare || navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${text} ${url}` })
        return 'sheet'
      } catch (err: any) {
        if (err?.name === 'AbortError') return 'cancelled'
      }
    }
  }
  if (blob && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
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
      return 'fallback'
    }
  }
  if (!blob) window.open(xIntentUrl(text, url), '_blank', 'noopener')
  return 'fallback'
}
