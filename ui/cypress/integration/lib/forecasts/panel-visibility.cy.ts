import fs from 'fs'
import path from 'path'
import { forecastPanelShouldMount } from '@/lib/forecasts/visibility'

const UI_ROOT = path.resolve(__dirname, '../../../../')

describe('ForecastPanel visibility', () => {
  const states: Array<boolean | undefined> = [true, false, undefined]

  for (const restricted of states) {
    it(`mounts when restricted=${String(restricted)}`, () => {
      expect(forecastPanelShouldMount(restricted)).to.equal(true)
    })
  }

  it('ForecastSlot always mounts ForecastPanel and does not gate on restricted', () => {
    const slot = fs.readFileSync(
      path.join(UI_ROOT, 'components/deprize/detail/ForecastSlot.tsx'),
      'utf8'
    )
    const panel = fs.readFileSync(
      path.join(UI_ROOT, 'components/deprize/ForecastPanel.tsx'),
      'utf8'
    )
    expect(slot).to.match(/<ForecastPanel/)
    expect(slot).to.not.match(/if\s*\(\s*restricted/)
    expect(panel).to.match(/id=["']deprize-forecast["']/)
    expect(panel).to.match(/useDePrizeRestricted/)
    expect(panel).to.not.match(/if\s*\(\s*restricted\s*\)\s*return/)
    expect(panel).to.not.match(/restricted\s*\?\s*null/)
  })
})
