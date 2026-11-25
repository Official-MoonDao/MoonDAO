import { parse } from 'parse5'
import { isAllowedImageUrl, normalizeThumbnail } from './newsletter'

/**
 * Turns the HTML body of a Kit broadcast into the markdown that Updates posts
 * are written in, so a newsletter issue renders with the same components as a
 * native post.
 *
 * Kit email HTML is mostly layout tables, inline styles and Outlook fallbacks.
 * This keeps the content (headings, paragraphs, lists, quotes, images,
 * buttons, videos and embedded posts from X) and drops the rest. Anything Kit
 * hides from its own public posts (polls, countdown timers, sections marked
 * "hide in public posts", the merge tags for a reader's name) is dropped too.
 *
 * The output is fed to `UpdateMarkdown`, which allows raw HTML. Every piece of
 * text is escaped and the only raw HTML is the handful of tags written here,
 * with escaped attributes, so nothing in the email can inject markup.
 */

// parse5's default tree is plain objects; this is the part of it read here.
type HtmlNode = {
  nodeName: string
  tagName?: string
  value?: string
  attrs?: { name: string; value: string }[]
  childNodes?: HtmlNode[]
  content?: HtmlNode
}

export type KitBodyOptions = {
  /** The issue title. A leading heading that repeats it is dropped. */
  title?: string
  /** The card image. A leading image that repeats it is dropped. */
  heroImage?: string | null
}

const SKIPPED_TAGS = new Set([
  'style',
  'script',
  'head',
  'title',
  'meta',
  'link',
  'noscript',
  'template',
  'svg',
  'form',
  'input',
  'button',
])

const INLINE_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'br',
  'code',
  'em',
  'font',
  'i',
  'img',
  'mark',
  's',
  'small',
  'span',
  'strike',
  'strong',
  'sub',
  'sup',
  'u',
  'del',
])

const HIDDEN_CLASSES = ['ck-hide-in-public-posts', 'ck-poll', 'preheader']

const TRACKING_PARAMS = /^(utm_[a-z]+|ck_subscriber_id|mc_[a-z]+)$/i
const SITE_HOSTS = new Set(['moondao.com', 'www.moondao.com'])

const BR = '\u0000'

function attr(node: HtmlNode, name: string): string {
  return node.attrs?.find((a) => a.name === name)?.value ?? ''
}

function hasClass(node: HtmlNode, name: string): boolean {
  return attr(node, 'class').split(/\s+/).includes(name)
}

function children(node: HtmlNode): HtmlNode[] {
  if (node.tagName === 'template' && node.content) return node.content.childNodes || []
  return node.childNodes || []
}

function isElement(node: HtmlNode): boolean {
  return typeof node.tagName === 'string'
}

function isHidden(node: HtmlNode): boolean {
  if (!isElement(node)) return false
  if (HIDDEN_CLASSES.some((name) => hasClass(node, name))) return true
  const style = attr(node, 'style').replace(/\s+/g, '').toLowerCase()
  return style.includes('display:none') || style.includes('mso-hide:all')
}

function descendants(node: HtmlNode, test: (n: HtmlNode) => boolean): HtmlNode[] {
  const found: HtmlNode[] = []
  const walk = (n: HtmlNode) => {
    for (const child of children(n)) {
      if (test(child)) found.push(child)
      walk(child)
    }
  }
  walk(node)
  return found
}

function first(node: HtmlNode, test: (n: HtmlNode) => boolean): HtmlNode | null {
  return descendants(node, test)[0] ?? null
}

function rawText(node: HtmlNode): string {
  if (node.nodeName === '#text') return node.value || ''
  if (!isElement(node) || SKIPPED_TAGS.has(node.tagName!) || isHidden(node)) return ''
  if (node.tagName === 'br') return '\n'
  return children(node).map(rawText).join('')
}

/** Kit merge tags (`{{ subscriber.first_name }}`) and Liquid blocks (`{% poll %}`). */
function stripTemplateTags(text: string): string {
  return text.replace(/\{%[\s\S]*?%\}/g, '').replace(/\{\{[\s\S]*?\}\}/g, '')
}

function cleanSpaces(text: string): string {
  return text.replace(/[​-‍⁠﻿]/g, '').replace(/[\s ]+/g, ' ')
}

export function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([*_`[\]~|])/g, '\\$1')
}

export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Markdown that would start a heading, list or quote if it opened a line. */
function escapeLineStart(line: string): string {
  return line.replace(/^(\s*)(#{1,6}\s|[-+]\s|\d+[.)]\s|=+\s*$|-{3,}\s*$)/, '$1\\$2')
}

/**
 * Returns a link target that is safe to render, or null. Tracking parameters
 * are dropped and links to moondao.com become on-site routes.
 */
export function cleanHref(raw: string): string | null {
  const href = raw.trim()
  if (!href) return null
  if (/^mailto:/i.test(href)) return href.replace(/[\s()<>]/g, encodeURIComponent)
  if (href.startsWith('#')) return null

  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  for (const key of Array.from(url.searchParams.keys())) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key)
  }
  const value = SITE_HOSTS.has(url.hostname)
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString()
  return value.replace(/[\s()<>]/g, encodeURIComponent)
}

function youtubeId(href: string): string | null {
  return (
    href.match(
      /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    )?.[1] ?? null
  )
}

function wrap(marker: string, inner: string): string {
  const match = inner.match(/^(\s*)([\s\S]*?)(\s*)$/)!
  if (!match[2] || match[2] === BR) return inner
  // Kit nests the same emphasis twice; one marker pair is enough.
  if (match[2].startsWith(marker) && match[2].endsWith(marker)) return inner
  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`
}

function imageMarkdown(node: HtmlNode): string {
  const src = normalizeThumbnail(attr(node, 'src'))
  if (!src) return ''
  const alt = cleanSpaces(attr(node, 'alt')).trim()
  return `![${escapeMarkdown(alt === 'video' ? '' : alt)}](${src.replace(
    /[\s()<>]/g,
    encodeURIComponent
  )})`
}

function inline(node: HtmlNode): string {
  if (node.nodeName === '#text') {
    return escapeMarkdown(cleanSpaces(stripTemplateTags(node.value || '')))
  }
  if (!isElement(node) || SKIPPED_TAGS.has(node.tagName!) || isHidden(node)) return ''

  const inner = () => children(node).map(inline).join('')
  switch (node.tagName) {
    case 'br':
      return BR
    case 'strong':
    case 'b':
      return wrap('**', inner())
    case 'em':
    case 'i':
      return wrap('*', inner())
    case 's':
    case 'strike':
    case 'del':
      return wrap('~~', inner())
    case 'code':
      return wrap('`', cleanSpaces(rawText(node)).replace(/`/g, ''))
    case 'img':
      return imageMarkdown(node)
    case 'a': {
      const content = inner()
      const href = cleanHref(attr(node, 'href'))
      if (!href || !content.replace(new RegExp(BR, 'g'), '').trim()) return content
      const match = content.match(/^(\s*)([\s\S]*?)(\s*)$/)!
      return `${match[1]}[${match[2]}](${href})${match[3]}`
    }
    default:
      return inner()
  }
}

function finishInline(text: string): string {
  const lines = text
    .split(BR)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line, index, all) => line || (index > 0 && index < all.length - 1))
  const joined = lines
    .join(BR)
    .replace(new RegExp(`${BR}{2,}`, 'g'), BR)
    .replace(new RegExp(`^${BR}+|${BR}+$`, 'g'), '')
  return joined
    .split(BR)
    .map(escapeLineStart)
    .join('\\\n')
    .replace(/\*\*\*\*/g, '')
    .trim()
}

function isInline(node: HtmlNode): boolean {
  if (node.nodeName === '#text') return true
  if (!isElement(node)) return false
  if (node.tagName === 'a') {
    // A button or a linked image stands on its own line.
    return !hasClass(node, 'email-button') && !first(node, (n) => n.tagName === 'img')
  }
  if (node.tagName === 'img') return false
  if (node.tagName === 'span' || node.tagName === 'font') {
    return !first(node, (n) => isElement(n) && !INLINE_TAGS.has(n.tagName!))
  }
  return INLINE_TAGS.has(node.tagName!)
}

type Block = { kind: 'heading' | 'text' | 'image' | 'other'; markdown: string; src?: string }

function figureBlock(link: string | null, img: HtmlNode, caption: string): Block | null {
  const src = normalizeThumbnail(attr(img, 'src'))
  if (!src) return null
  const video = link ? youtubeId(link) : null
  if (video) {
    const title = cleanSpaces(attr(img, 'alt')).trim() || 'Video'
    const frame = `<iframe src="https://www.youtube.com/embed/${video}" title="${escapeAttribute(
      title
    )}" allowfullscreen></iframe>`
    return {
      kind: 'image',
      src,
      markdown: caption
        ? `<figure>\n\n${frame}\n\n<figcaption>\n\n${caption}\n\n</figcaption>\n\n</figure>`
        : frame,
    }
  }
  const image = imageMarkdown(img)
  const body = link ? `[${image}](${link})` : image
  return {
    kind: 'image',
    src,
    markdown: caption
      ? `<figure>\n\n${body}\n\n<figcaption>\n\n${caption}\n\n</figcaption>\n\n</figure>`
      : body,
  }
}

function imageFrom(node: HtmlNode): Block | null {
  const img = node.tagName === 'img' ? node : first(node, (n) => n.tagName === 'img')
  if (!img) return null
  const anchor =
    node.tagName === 'a'
      ? node
      : first(node, (n) => n.tagName === 'a' && !!first(n, (m) => m === img))
  const link = anchor ? cleanHref(attr(anchor, 'href')) : null
  const captionNode = first(node, (n) => n.tagName === 'figcaption')
  const caption = captionNode ? finishInline(children(captionNode).map(inline).join('')) : ''
  return figureBlock(link, img, caption)
}

function videoBlock(node: HtmlNode): Block | null {
  const video = node.tagName === 'video' ? node : first(node, (n) => n.tagName === 'video')
  if (!video) return null
  const sources = descendants(video, (n) => n.tagName === 'source')
    .map((s) => attr(s, 'src'))
    .filter((src) => isAllowedImageUrl(src))
  // Kit lists an HLS stream first, which only Safari plays, then an MP4,
  // which every browser plays. Keep just the MP4 when there is one.
  const mp4 = sources.filter((src) => /[?&]format=mp4\b/.test(src))
  if (sources.length === 0) return null
  const poster = attr(video, 'poster')
  const posterAttr = isAllowedImageUrl(poster) ? ` poster="${escapeAttribute(poster)}"` : ''
  const tags = mp4.length
    ? mp4.map((src) => `<source src="${escapeAttribute(src)}" type="video/mp4" />`).join('')
    : sources.map((src) => `<source src="${escapeAttribute(src)}" />`).join('')
  return {
    kind: 'other',
    markdown: `<video controls preload="none"${posterAttr}>${tags}</video>`,
  }
}

function isTweetCard(node: HtmlNode): boolean {
  if (node.tagName !== 'table') return false
  const style = attr(node, 'style').replace(/\s+/g, '')
  if (!style.includes('max-width:450px') && attr(node, 'width') !== '450') return false
  return !!first(node, (n) => n.tagName === 'img' && /profile avatar/i.test(attr(n, 'alt')))
}

/** An X post Kit pasted in as a card, rendered as a callout linking to it. */
function tweetBlock(node: HtmlNode): Block | null {
  const link = first(node, (n) => n.tagName === 'a' && /\/status\/\d+/.test(attr(n, 'href')))
  const href = link ? cleanHref(attr(link, 'href')) : null
  const textNode = first(node, (n) =>
    attr(n, 'style').replace(/\s+/g, '').includes('white-space:pre-wrap')
  )
  const handle = descendants(node, (n) => n.nodeName === '#text')
    .map((n) => (n.value || '').trim())
    .find((value) => /^@\w{1,30}$/.test(value))
  const text = textNode ? stripTemplateTags(rawText(textNode)) : ''
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((line) => escapeLineStart(escapeMarkdown(cleanSpaces(line).trim())))
        .filter(Boolean)
        .join('\\\n')
    )
    .filter(Boolean)
  const images = descendants(
    node,
    (n) =>
      n.tagName === 'img' &&
      !/avatar|logo/i.test(attr(n, 'alt')) &&
      !attr(n, 'src').includes('profile_images')
  )
    .map(imageMarkdown)
    .filter(Boolean)
  if (!href && paragraphs.length === 0) return null

  const title = handle ? `${handle} on X` : 'On X'
  const parts = [...paragraphs, ...images.slice(0, 1)]
  if (href) parts.push(`[View the post on X](${href})`)
  return {
    kind: 'other',
    markdown: `<aside data-title="${escapeAttribute(title)}">\n\n${parts.join('\n\n')}\n\n</aside>`,
  }
}

function listMarkdown(node: HtmlNode, depth: number): string {
  const ordered = node.tagName === 'ol'
  const indent = '   '.repeat(depth)
  const items: string[] = []
  let index = 1
  for (const item of children(node)) {
    if (item.tagName !== 'li' || isHidden(item)) continue
    const nested: string[] = []
    const parts: string[] = []
    for (const child of children(item)) {
      if (child.tagName === 'ul' || child.tagName === 'ol') {
        nested.push(listMarkdown(child, depth + 1))
      } else if (isInline(child)) {
        parts.push(inline(child))
      } else {
        // A paragraph inside an item: keep its text on the item line.
        parts.push(` ${children(child).map(inline).join('')} `)
      }
    }
    const text = finishInline(parts.join('')).replace(/\\\n/g, `\\\n${indent}   `)
    if (!text && nested.length === 0) continue
    const marker = ordered ? `${index++}.` : '-'
    items.push([`${indent}${marker} ${text}`.trimEnd(), ...nested].join('\n'))
  }
  return items.join('\n')
}

function collect(node: HtmlNode, out: Block[]): void {
  let buffer: HtmlNode[] = []
  const flush = () => {
    if (buffer.length === 0) return
    const text = finishInline(buffer.map(inline).join(''))
    buffer = []
    if (text) out.push({ kind: 'text', markdown: text })
  }

  for (const child of children(node)) {
    if (child.nodeName === '#comment') continue
    if (isHidden(child)) continue
    if (isInline(child)) {
      buffer.push(child)
      continue
    }
    flush()
    block(child, out)
  }
  flush()
}

function block(node: HtmlNode, out: Block[]): void {
  if (!isElement(node) || SKIPPED_TAGS.has(node.tagName!) || isHidden(node)) return
  const tag = node.tagName!

  if (/^h[1-6]$/.test(tag)) {
    const level = Math.min(4, Math.max(2, Number(tag[1])))
    const text = finishInline(children(node).map(inline).join('')).replace(/\\\n/g, ' ')
    if (text) out.push({ kind: 'heading', markdown: `${'#'.repeat(level)} ${text}` })
    return
  }

  switch (tag) {
    case 'p':
      // A paragraph can hold a linked image, which becomes its own block.
      collect(node, out)
      return
    case 'ul':
    case 'ol': {
      const list = listMarkdown(node, 0)
      if (list) out.push({ kind: 'text', markdown: list })
      return
    }
    case 'blockquote': {
      const inner: Block[] = []
      collect(node, inner)
      const quote = inner
        .map((b) => b.markdown)
        .join('\n\n')
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n')
      if (inner.length) out.push({ kind: 'text', markdown: quote })
      return
    }
    case 'hr':
      out.push({ kind: 'other', markdown: '---' })
      return
    case 'img':
    case 'figure': {
      const image = imageFrom(node)
      if (image) out.push(image)
      return
    }
    case 'video': {
      const video = videoBlock(node)
      if (video) out.push(video)
      return
    }
    case 'a': {
      if (hasClass(node, 'email-button')) {
        const href = cleanHref(attr(node, 'href'))
        const label = escapeMarkdown(cleanSpaces(stripTemplateTags(rawText(node))).trim())
        if (href && label) {
          out.push({
            kind: 'other',
            markdown: `<a href="${escapeAttribute(href)}" data-button="true">${label}</a>`,
          })
        }
        return
      }
      const image = imageFrom(node)
      if (image) out.push(image)
      return
    }
  }

  if (tag === 'table' && hasClass(node, 'email-image')) {
    const image = imageFrom(node)
    if (image) out.push(image)
    return
  }
  if (attr(node, 'data-video-container') === 'true') {
    const video = videoBlock(node)
    if (video) out.push(video)
    return
  }
  if (isTweetCard(node)) {
    const tweet = tweetBlock(node)
    if (tweet) out.push(tweet)
    return
  }
  if (tag === 'div' && hasClass(node, 'blockquotes')) {
    block({ ...node, tagName: 'blockquote', attrs: [] }, out)
    return
  }

  // Layout wrappers: tables, cells, sections and divs.
  collect(node, out)
}

function comparable(text: string): string {
  return text
    .replace(/\\(.)/g, '$1')
    .replace(/&amp;/g, '&')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

const GREETING = /^(?:hey|hi|hello|gm|greetings)\b(?:\s+[\w'’-]+){0,3}\s*[,!.:—-]?$/i
const EMPTY_GREETING = /^(?:hey|hi|hello)\s*,\s*(?:\\\n)?\s*(?:and\s+)?/i

/** Converts a Kit broadcast body to Updates markdown. */
export function kitHtmlToMarkdown(html: string, options: KitBodyOptions = {}): string {
  const blocks: Block[] = []
  collect(parse(html) as unknown as HtmlNode, blocks)

  // Drop what the page header already shows, or what only makes sense in an
  // inbox, from the first few blocks.
  const title = options.title ? comparable(options.title) : ''
  const hero = options.heroImage ? normalizeThumbnail(options.heroImage) : null
  let index = 0
  let greeted = false
  while (index < blocks.length && index < 3) {
    const lead = blocks[index]
    const isTitle = lead.kind === 'heading' && !!title && comparable(lead.markdown) === title
    const isHero = lead.kind === 'image' && !!hero && lead.src === hero
    const isGreeting: boolean =
      !greeted && lead.kind === 'text' && GREETING.test(lead.markdown.replace(/\\/g, ''))
    if (isTitle || isHero || isGreeting) {
      blocks.splice(index, 1)
      if (isGreeting) greeted = true
      continue
    }
    if (lead.kind === 'text' && !greeted) {
      // "Hey {{ first_name }}, welcome to…" loses the name with the merge tag.
      const rest = lead.markdown.replace(EMPTY_GREETING, '')
      if (rest && rest !== lead.markdown) {
        lead.markdown = rest.charAt(0).toUpperCase() + rest.slice(1)
      }
      // Past the first paragraph, a greeting is part of the body.
      greeted = true
    }
    index++
  }

  const markdown = blocks
    .map((b) => b.markdown)
    .filter((md, i, all) => md !== '---' || (i > 0 && i < all.length - 1 && all[i - 1] !== '---'))
    .join('\n\n')
  return markdown ? `${markdown}\n` : ''
}
