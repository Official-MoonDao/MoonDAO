import { expect } from 'chai'
import sharp from 'sharp'
import { getOgFontDataUri } from '../lib/og/installOgFonts'
import { embedOgFontFace, ogFontIsBundled, rasterizeOgSvg } from '../lib/og/rasterize'
import { renderOgSvg } from '../lib/og/svg'

/**
 * Sharp + bundled TTF live in Node. Cypress component tests run in the browser,
 * where `fs.existsSync` is not a function — that is what failed the CT shard.
 */
describe('OG rasterize', () => {
  it('embeds Lato and paints readable title pixels', async () => {
    expect(ogFontIsBundled()).to.equal(true)
    expect(getOgFontDataUri()).to.be.a('string').and.include('data:font/ttf;base64,')

    const svg = renderOgSvg({
      eyebrow: 'MoonDAO  ·  Jobs',
      title: 'Social Media Manager',
      subtitle: 'Executive Branch',
      chips: ['Marketing', 'Part-time'],
      footer: 'moondao.com/jobs',
    })
    const withFont = embedOgFontFace(svg)
    expect(withFont).to.include('font-family:Lato')
    expect(withFont).to.include('font-family="Lato, sans-serif"')

    const png = await rasterizeOgSvg(svg)
    const image = sharp(png)
    const meta = await image.metadata()
    expect(meta.width).to.equal(1200)
    expect(meta.height).to.equal(630)
    expect(meta.format).to.equal('png')

    // Title baseline sits at y=200. White Lato glyphs must be present; a
    // missing-font card is only the dark gradient (channel max ~50).
    const titleStats = await sharp(png)
      .extract({ left: 50, top: 160, width: 700, height: 80 })
      .stats()
    expect(titleStats.channels[0].max).to.be.greaterThan(200)
  })
})
