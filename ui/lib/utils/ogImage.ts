import { DEPLOYED_ORIGIN, IPFS_GATEWAY } from 'const/config'

// Served from our own origin rather than an IPFS gateway: link-preview crawlers
// abandon the image after a couple of seconds, and ipfs.io 504s on MoonDAO CIDs.
// Apex moondao.com 307s to www; crawlers often drop og:image on that redirect.
export const DEFAULT_OG_IMAGE_PATH = '/metadata-image.png'

/**
 * Section cards (1200×630) used when a page doesn't pass its own image, so
 * every DePrize race (/deprize/arb/1, /deprize/arb/2, …) shares the DePrize
 * card instead of the generic one.
 */
const SECTION_OG_IMAGES: { prefix: string; path: string }[] = [
  { prefix: '/deprize', path: '/deprize-launch-og.png' },
  { prefix: '/moonbase', path: '/moonbase-launch-og.png' },
]
export const SECTION_OG_IMAGE_SIZE = { width: 1200, height: 630 }

export function sectionOgImage(pathname: string): string | undefined {
  return SECTION_OG_IMAGES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )?.path
}

/**
 * Resolve any image reference to an absolute URL a link-preview crawler can
 * actually fetch.
 *
 * `ipfs://` URIs go to MoonDAO's dedicated Pinata gateway, which is the only
 * gateway that reliably serves MoonDAO's pins. Pass raw `ipfs://` URIs in —
 * pre-building a public-gateway URL at the call site looks like an
 * already-resolved https URL here and gets passed through untouched.
 */
function preferWww(url: string): string {
  if (url === 'https://moondao.com') return 'https://www.moondao.com'
  if (url.startsWith('https://moondao.com/')) {
    return `https://www.moondao.com/${url.slice('https://moondao.com/'.length)}`
  }
  return url
}

export function normalizeOgImageUrl(image?: string): string {
  if (!image) return preferWww(`${DEPLOYED_ORIGIN}${DEFAULT_OG_IMAGE_PATH}`)

  if (image.startsWith('http://') || image.startsWith('https://')) {
    return preferWww(image)
  }

  if (image.startsWith('ipfs://')) {
    return `${IPFS_GATEWAY}${image.replace('ipfs://', '')}`
  }

  if (image.startsWith('/')) {
    return preferWww(`${DEPLOYED_ORIGIN}${image}`)
  }

  return `${IPFS_GATEWAY}${image}`
}
