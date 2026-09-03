import { getOgFontDataUri, installOgFonts, resolveOgFontPath } from './installOgFonts'
import { readFileSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

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

const FALLBACK_CANDIDATES = [
  join(process.cwd(), 'public/metadata-image.png'),
  join(process.cwd(), 'ui/public/metadata-image.png'),
  join(process.cwd(), 'public/assets/MoonDAO-OG.png'),
  join(process.cwd(), 'ui/public/assets/MoonDAO-OG.png'),
]

function readFallbackPng(): Buffer | undefined {
  for (const candidate of FALLBACK_CANDIDATES) {
    try {
      return readFileSync(candidate)
    } catch {
      // try the next known static card
    }
  }
  return undefined
}

/** Rasterise an OG SVG with the bundled Lato font. */
export async function rasterizeOgSvg(svg: string): Promise<Buffer> {
  installOgFonts()
  try {
    return await sharp(Buffer.from(embedOgFontFace(svg))).png().toBuffer()
  } catch (error) {
    console.error('Failed to rasterize OG card:', error)
    const fallback = readFallbackPng()
    if (fallback) return fallback
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
