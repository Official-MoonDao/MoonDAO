/// <reference types="node" />
/**
 * Acceptance: the DePrize surfaces hold up on a phone.
 *
 * These are source-level rules because the failures they guard against are
 * decisions in the markup, not values a pure function returns: a sticky column
 * that hides its own bottom, a list with no ceiling, a hard pixel minimum that
 * wraps a competitor's name under its odds, a control too small to hit, and an
 * input small enough that iOS zooms the page when it takes focus.
 */
import fs from 'fs'
import path from 'path'

const UI_ROOT = path.resolve(__dirname, '../../../../')

function readUi(...parts: string[]): string {
  return fs.readFileSync(path.join(UI_ROOT, ...parts), 'utf8')
}

/** Every `<input …>` tag in a source file, attributes included. */
function inputTags(src: string): string[] {
  return src.split('<input').slice(1).map((chunk) => chunk.split('/>')[0])
}

const PRIMITIVES = 'components/deprize/detail/primitives.tsx'

/** Files whose tap targets must come from the shared token. */
const TOUCH_CONSUMERS = [
  'components/deprize/PredictModal.tsx',
  'components/deprize/DePrizeTeamCard.tsx',
  'components/deprize/DePrizePositionPanel.tsx',
  'components/deprize/DePrizePatrons.tsx',
  'components/deprize/BetModal.tsx',
  'components/deprize/LiveDePrizeHero.tsx',
  'components/deprize/DePrizeIndexContent.tsx',
  'components/deprize/detail/PrizeHeader.tsx',
  'components/deprize/detail/PrizePoolSlot.tsx',
]

/** Surfaces where a user types, so the text has to survive an iOS focus. */
const TYPED_SURFACES = [
  'components/deprize/BetModal.tsx',
  'components/deprize/DePrizeIndexContent.tsx',
]

describe('deprize responsive layout', () => {
  it('defines one 44px touch floor that relaxes on pointer devices', () => {
    const src = readUi(PRIMITIVES)
    const match = src.match(/export const TOUCH =\s*'([^']+)'/)
    expect(match, 'primitives must export a TOUCH token').to.not.equal(null)
    const touch = (match as RegExpMatchArray)[1]
    expect(touch).to.match(/min-h-\[44px\]/)
    expect(touch, 'a 44px row would read as loose with a cursor').to.match(/sm:min-h-0/)
  })

  it('defines a scroll ceiling for lists that grow without bound', () => {
    const src = readUi(PRIMITIVES)
    const match = src.match(/export const SCROLL_LIST =\s*'([^']+)'/)
    expect(match, 'primitives must export a SCROLL_LIST token').to.not.equal(null)
    const scroll = (match as RegExpMatchArray)[1]
    expect(scroll).to.match(/max-h-\[/)
    expect(scroll).to.match(/overflow-y-auto/)
    expect(scroll, 'a nested list must not steal the page scroll').to.match(/overscroll-contain/)
  })

  it('lets the sticky sidebar scroll itself instead of hiding its own bottom', () => {
    const src = readUi('pages/deprize/[id].tsx')
    const aside = src.slice(src.indexOf('<aside'), src.indexOf('</aside>'))
    expect(aside).to.match(/lg:sticky/)
    expect(aside, 'a sticky column taller than the viewport traps its tail').to.match(
      /lg:max-h-\[calc\(100vh/
    )
    expect(aside).to.match(/lg:overflow-y-auto/)
  })

  it('caps the patron and caller lists so one long prize cannot bury the page', () => {
    for (const file of [
      'components/deprize/DePrizePatrons.tsx',
      'components/deprize/DePrizeCallers.tsx',
    ]) {
      const src = readUi(file)
      expect(src, `${file} should import SCROLL_LIST`).to.match(/SCROLL_LIST/)
      expect(src, `${file} should apply it to the list`).to.match(/<ul[^>]*SCROLL_LIST/)
    }
  })

  it('keeps every row identity truncatable next to its amount', () => {
    for (const file of [
      'components/deprize/DePrizePatrons.tsx',
      'components/deprize/DePrizeCallers.tsx',
    ]) {
      const src = readUi(file)
      const row = src.slice(src.indexOf('<li'), src.indexOf('</li>'))
      expect(row, `${file} row needs a shrinkable identity column`).to.match(/min-w-0/)
      expect(row, `${file} amount must not be squeezed`).to.match(/shrink-0/)
    }
  })

  it('never makes a competitor card wider than a phone before sm', () => {
    const src = readUi('components/deprize/DePrizeTeamCard.tsx')
    const mins = src.match(/[\w:-]*min-w-\[\d+px\]/g) ?? []
    expect(mins.length, 'the card still wants pixel minimums').to.be.greaterThan(0)
    for (const min of mins) {
      expect(min, `${min} must wait for sm: or it wraps the name under the odds`).to.match(
        /^sm:min-w-\[/
      )
    }
  })

  it('makes the competitor card the full-width predict control', () => {
    const src = readUi('components/deprize/DePrizeTeamCard.tsx')
    expect(src, 'the card is the prediction; there is no separate Back button').to.not.include(
      '<StandardButton'
    )
    expect(src).to.match(/Predict \$\{predictName\} as the winner/)
    const card = src.slice(src.indexOf('className={`relative w-full'))
    expect(card.slice(0, 80)).to.match(/relative w-full/)
    const buttonAt = src.lastIndexOf('<button')
    const cashOut = src.slice(buttonAt, src.indexOf('Cash out', buttonAt))
    expect(cashOut).to.match(/\$\{TOUCH\}/)
  })

  it('sizes every DePrize control from the shared touch floor', () => {
    for (const file of TOUCH_CONSUMERS) {
      const src = readUi(file)
      expect(src, `${file} should import TOUCH from detail/primitives`).to.match(
        /import \{[^}]*TOUCH[^}]*\} from '(@\/components\/deprize\/detail\/primitives|\.\/primitives)'/
      )
      expect(src, `${file} should apply TOUCH to its controls`).to.match(/\$\{TOUCH\}/)
    }
  })

  it('keeps typed text at 16px on phones so iOS does not zoom the page', () => {
    for (const file of TYPED_SURFACES) {
      for (const tag of inputTags(readUi(file))) {
        if (/type="checkbox"/.test(tag)) continue
        expect(tag, `an input in ${file} is below 16px on mobile:\n${tag}`).to.match(
          /text-base/
        )
      }
    }
  })

  it('opens a decimal keypad for money instead of a full keyboard', () => {
    for (const file of ['components/deprize/BetModal.tsx']) {
      for (const tag of inputTags(readUi(file))) {
        if (!/type="number"/.test(tag)) continue
        expect(tag, `a number input in ${file} has no inputMode:\n${tag}`).to.match(
          /inputMode="decimal"/
        )
      }
    }
  })

  it('never shrinks the bet disclosures below 12px on a phone', () => {
    const src = readUi('components/deprize/BetModal.tsx')
    const tiny = src.match(/[\w:/-]*text-\[11px\]/g) ?? []
    expect(tiny.length, 'the modal still uses 11px somewhere').to.be.greaterThan(0)
    for (const cls of tiny) {
      expect(cls, `${cls} must wait for sm: — this is the risk copy`).to.match(/^sm:text-\[11px\]/)
    }
    for (const tag of inputTags(src)) {
      if (!/type="checkbox"/.test(tag)) continue
      expect(tag, `a checkbox is under 20px:\n${tag}`).to.match(/h-5 w-5/)
    }
  })

  it('gives a text link that acts as a button a real hit area on a phone', () => {
    // Measured at 390px before this change: "Fund the prize" was 16px tall and
    // "All prizes" 20px, which is a miss more often than a hit.
    const header = readUi('components/deprize/detail/PrizeHeader.tsx')
    for (const anchor of header.split('<Link').concat(header.split('<a'))) {
      if (!/\$\{TOUCH\}/.test(anchor)) continue
      expect(anchor, 'a min-height needs a flex box to center in').to.match(
        /inline-flex items-center/
      )
    }
    expect(header.match(/\$\{TOUCH\}/g) ?? [], 'the Moon Base and All prizes links').to.have.length(
      2
    )
  })

  it('shows betting volume beside the prize pool without restoring header stats', () => {
    const slot = readUi('components/deprize/detail/PrizePoolSlot.tsx')
    expect(slot).to.include('Betting volume')
    expect(slot).to.include('volumeEth')
    const header = readUi('components/deprize/detail/PrizeHeader.tsx')
    expect(header).to.not.include('Backers')
    expect(header).to.not.include('Betting closes')
    expect(header).to.not.include('Total volume')
    const page = readUi('pages/deprize/[id].tsx')
    expect(page).to.match(/volumeEth=\{[\s\S]*totalStakedEth/)
  })

  it('left-aligns the hero prize figure once it wraps under the title', () => {
    const src = readUi('components/deprize/LiveDePrizeHero.tsx')
    expect(src).to.match(/w-full sm:w-auto text-left sm:text-right/)
    expect(src, 'a shrink-0 block cannot share a line with a long title').to.not.match(
      /className="text-right shrink-0"/
    )
  })
})

export {}
