import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'

const FONT_FILENAME = 'Lato-Regular.ttf'

/**
 * Places we may find Lato after a Vercel/Next compile. `public/` is not always
 * copied into the serverless bundle, so `lib/og/fonts` is the primary copy.
 */
function fontSearchRoots(): string[] {
  const roots = [
    join(__dirname, 'fonts'),
    join(process.cwd(), 'lib/og/fonts'),
    join(process.cwd(), 'ui/lib/og/fonts'),
    join(process.cwd(), 'public/fonts'),
    join(process.cwd(), 'ui/public/fonts'),
  ]
  try {
    roots.push(join(dirname(dirname(__dirname)), 'public/fonts'))
  } catch {
    // __dirname can be rewritten in the serverless bundle.
  }
  return roots
}

export function resolveOgFontPath(): string | undefined {
  for (const root of fontSearchRoots()) {
    const candidate = join(root, FONT_FILENAME)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

let fontDataUri: string | undefined
let fontconfigReady = false

export function getOgFontDataUri(): string | undefined {
  if (fontDataUri) return fontDataUri
  const fontPath = resolveOgFontPath()
  if (!fontPath) return undefined
  fontDataUri = `data:font/ttf;base64,${readFileSync(fontPath).toString('base64')}`
  return fontDataUri
}

/**
 * Point fontconfig at a temp dir that contains only Lato, and map `sans-serif`
 * onto it. Must run before Sharp/librsvg first initialises pango.
 *
 * Vercel images have no system UI fonts, so SVG `font-family="sans-serif"`
 * otherwise rasterises as empty tofu boxes — which is what link-preview
 * crawlers were showing for /jobs/22.
 */
export function installOgFonts(): string | undefined {
  if (fontconfigReady) return process.env.FONTCONFIG_PATH

  const fontPath = resolveOgFontPath()
  if (!fontPath) return undefined

  const dir = join(tmpdir(), 'moondao-og-fonts')
  mkdirSync(join(dir, 'cache'), { recursive: true })
  const bundled = join(dir, FONT_FILENAME)
  if (!existsSync(bundled)) {
    copyFileSync(fontPath, bundled)
  }

  writeFileSync(
    join(dir, 'fonts.conf'),
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${dir}</dir>
  <cachedir>${join(dir, 'cache')}</cachedir>
  <match target="pattern">
    <test qual="any" name="family"><string>sans-serif</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Lato</string></edit>
  </match>
  <match target="pattern">
    <test qual="any" name="family"><string>Lato</string></test>
    <edit name="family" mode="assign" binding="same"><string>Lato</string></edit>
  </match>
</fontconfig>
`
  )

  process.env.FONTCONFIG_PATH = dir
  process.env.FONTCONFIG_FILE = join(dir, 'fonts.conf')
  fontconfigReady = true
  return dir
}
