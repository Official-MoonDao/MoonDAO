import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { getOgFontDataUri, installOgFonts, resolveOgFontPath } from './installOgFonts'

installOgFonts()

/** Librsvg needs the face in the SVG itself; fontconfig alone is not enough on Vercel. */
export function embedOgFontFace(svg: string): string {
  const dataUri = getOgFontDataUri()
  if (!dataUri || svg.includes('@font-face{font-family:Lato')) return svg
  return svg.replace(
    '<defs>',
    `<defs>\n    <style>@font-face{font-family:Lato;src:url('${dataUri}') format('truetype');}</style>`
  )
}

/**
 * Literal paths Node File Tracing can follow. A loop of `join(root, name)` is
 * invisible to NFT, so without these (and `outputFileTracingIncludes`) Vercel
 * ships the OG functions with no fallback card.
 */
const MODULE_FALLBACK_PATH = join(__dirname, '../../public/metadata-image.png')
const TRACED_FALLBACK_PATH = join(process.cwd(), 'public/metadata-image.png')
const TRACED_FALLBACK_PATH_UI = join(process.cwd(), 'ui/public/metadata-image.png')
const MODULE_OG_FALLBACK_PATH = join(__dirname, '../../public/assets/MoonDAO-OG.png')
const TRACED_OG_FALLBACK_PATH = join(process.cwd(), 'public/assets/MoonDAO-OG.png')
const TRACED_OG_FALLBACK_PATH_UI = join(process.cwd(), 'ui/public/assets/MoonDAO-OG.png')

const SUCCESS_CACHE_CONTROL = 'public, immutable, no-transform, max-age=86400'
const FALLBACK_CACHE_CONTROL = 'public, no-transform, max-age=0, s-maxage=0, must-revalidate'

export type RasterizeOgResult = {
  png: Buffer
  usedFallback: boolean
  cacheControl: string
}

function readFallbackPng(): Buffer | undefined {
  if (existsSync(MODULE_FALLBACK_PATH)) return readFileSync(MODULE_FALLBACK_PATH)
  if (existsSync(TRACED_FALLBACK_PATH)) return readFileSync(TRACED_FALLBACK_PATH)
  if (existsSync(TRACED_FALLBACK_PATH_UI)) return readFileSync(TRACED_FALLBACK_PATH_UI)
  if (existsSync(MODULE_OG_FALLBACK_PATH)) return readFileSync(MODULE_OG_FALLBACK_PATH)
  if (existsSync(TRACED_OG_FALLBACK_PATH)) return readFileSync(TRACED_OG_FALLBACK_PATH)
  if (existsSync(TRACED_OG_FALLBACK_PATH_UI)) return readFileSync(TRACED_OG_FALLBACK_PATH_UI)
  return undefined
}

/** Rasterise an OG SVG with the bundled Lato font. */
export async function rasterizeOgSvg(svg: string): Promise<RasterizeOgResult> {
  installOgFonts()
  try {
    return {
      png: await sharp(Buffer.from(embedOgFontFace(svg)))
        .png()
        .toBuffer(),
      usedFallback: false,
      cacheControl: SUCCESS_CACHE_CONTROL,
    }
  } catch (error) {
    console.error('Failed to rasterize OG card:', error)
    const fallback = readFallbackPng()
    if (fallback) {
      return { png: fallback, usedFallback: true, cacheControl: FALLBACK_CACHE_CONTROL }
    }
    throw error
  }
}

export async function rasterizeListingThumb(
  buffer: Buffer,
  width: number,
  height: number,
  maxPixels: number
): Promise<Buffer> {
  return sharp(buffer, { limitInputPixels: maxPixels })
    .resize(width, height, { fit: 'cover' })
    .png()
    .toBuffer()
}

export function ogFontIsBundled(): boolean {
  return Boolean(resolveOgFontPath())
}
