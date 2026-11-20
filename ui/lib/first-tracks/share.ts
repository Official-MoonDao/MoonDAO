/**
 * First Tracks share card and share plumbing (client-only).
 *
 * The image is the post: X suppresses links, so the card carries a 3D shot of
 * the player's tracks across the site, the score, verdict, site number, mode
 * and the URL printed on it. Challenge links, the clipboard and canvas helpers are
 * the same as Touchdown's and are shared unchanged.
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
import type { RunResult } from './scoring'
import { formatScore, isGoodOutcome, outcomeHeadline } from './verdicts'

export { canvasToBlob, challengeQuery, cleanNickname, copyImage, parseChallenge, xIntentUrl }
export type { Challenge, ShareMethod }

export const SHARE_PATH = '/rover'
export const SHARE_URL_LABEL = 'moondao.com/rover'
/** The game's name, as it appears on the card, the photo stamp and link previews. */
export const GAME_TITLE = 'LUNAR ROVER'
export const GAME_SUBTITLE = 'FIRST TRACKS'
export const CARD_W = 1200
export const CARD_H = 675

const DARE = 'Driving on the Moon with signal delay is HARD. Can you do better? 🌕'

/** Prefilled post text: what happened, the numbers people quote, and the dare. */
export function shareText(result: RunResult, rank?: number): string {
  const pro = result.mode === 'pro' ? ' (PRO 🏅)' : ''
  const place = rank ? ` · #${rank} today 🏆` : ''
  const score = `${formatScore(result.score)} pts${pro}${place}`
  const m = result.metres.toFixed(0)
  let lines: string[]
  switch (result.outcome) {
    case 'fell':
      lines = ['🫣 I drove a Moon rover straight off the side of its lander.', score]
      break
    case 'parked':
      lines = ['🅿️ I landed a rover on the Moon and never drove it off the lander.', score]
      break
    case 'tipped':
      lines = [`🙃 I laid ${m} m of tracks on the Moon, then rolled the rover into a crater.`, score]
      break
    case 'stuck':
      lines = [`🕳️ I drove ${m} m on the Moon and buried the rover in soft regolith.`, score]
      break
    case 'flat':
      lines = [`🪫 I drove ${m} m on the Moon and ran the rover's battery flat.`, score]
      break
    case 'complete':
      lines = [`🛰️ ${m} m of tracks on the Moon and all 8 science jobs done, through the signal delay.`, score]
      break
    default:
      lines = result.firstTracks
        ? [`🛞 I laid ${m} m of first tracks on the Moon. The orbiter has the photo.`, `${score} · ${result.imaged}/8 science jobs`]
        : ['📡 I lost signal before my rover made its first 10 m on the Moon.', score]
  }
  return [...lines, '', DARE].join('\n')
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

/**
 * Compose the 1200x675 share card over a frame of the finished drive (the 3D
 * pull-back shot, or a photo the player framed). The picture does the talking:
 * the card adds only the game's name, how the drive ended, the score and the URL.
 */
export function composeCard(args: { frame: HTMLCanvasElement; result: RunResult; nickname?: string; rank?: number }): HTMLCanvasElement {
  const { frame, result } = args
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

  const top = g.createLinearGradient(0, 0, 0, 140)
  top.addColorStop(0, 'rgba(0,0,0,0.7)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = top
  g.fillRect(0, 0, CARD_W, 140)
  const bottom = g.createLinearGradient(0, CARD_H - 250, 0, CARD_H)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(0.6, 'rgba(0,0,0,0.68)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.9)')
  g.fillStyle = bottom
  g.fillRect(0, CARD_H - 250, CARD_W, 250)

  const head = '"Archivo", "Lato", system-ui, sans-serif'
  const body = '"Lato", system-ui, sans-serif'
  g.textBaseline = 'alphabetic'
  g.textAlign = 'left'

  g.fillStyle = '#fff'
  g.font = `800 34px ${head}`
  g.fillText(GAME_TITLE, 48, 70)
  let x = 48 + g.measureText(GAME_TITLE).width + 16
  g.font = `700 22px ${head}`
  g.fillStyle = 'rgba(255,255,255,0.72)'
  g.fillText(GAME_SUBTITLE, x, 68)
  x += g.measureText(GAME_SUBTITLE).width + 20
  if (result.mode === 'pro') {
    g.fillStyle = '#ffd34d'
    roundRect(g, x, 40, 84, 38, 8)
    g.fill()
    g.fillStyle = '#111'
    g.font = `800 22px ${head}`
    g.textAlign = 'center'
    g.fillText('PRO', x + 42, 67)
    g.textAlign = 'left'
  }

  g.font = `800 26px ${head}`
  g.fillStyle = isGoodOutcome(result) ? '#7dffb0' : result.firstTracks ? '#ffd34d' : '#ff8a6b'
  g.fillText(outcomeHeadline(result).toUpperCase(), 48, CARD_H - 158)

  g.fillStyle = '#fff'
  g.font = `800 112px ${head}`
  const scoreText = formatScore(result.score)
  g.fillText(scoreText, 44, CARD_H - 44)
  const scoreW = g.measureText(scoreText).width
  g.font = `600 26px ${body}`
  g.fillStyle = 'rgba(255,255,255,0.7)'
  g.fillText('pts', 44 + scoreW + 12, CARD_H - 46)

  g.textAlign = 'right'
  const nick = cleanNickname(args.nickname)
  const who = [nick, args.rank ? `#${args.rank} today` : ''].filter(Boolean).join(' · ')
  if (who) {
    g.font = `600 22px ${body}`
    g.fillStyle = 'rgba(255,255,255,0.82)'
    g.fillText(who, CARD_W - 48, CARD_H - 82)
  }
  g.font = `700 26px ${body}`
  g.fillStyle = '#fff'
  g.fillText(SHARE_URL_LABEL, CARD_W - 48, CARD_H - 46)
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
  g.fillText(`${GAME_TITLE}: ${GAME_SUBTITLE}`, photo.width - 28 * s, photo.height - 54 * s)
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
    const file = new File([blob], 'lunar-rover.png', { type: 'image/png' })
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
