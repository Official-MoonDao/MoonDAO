/**
 * /deprize index layout: Live and Planned sections, card headings, and the
 * Water Ice prospecting chip. Pills for Live and Planned stay off the cards.
 */
import fs from 'fs'
import path from 'path'
import { isDePrizeGoalMarketBound } from '@/lib/deprize/competitions'
import { raceCardHeading } from '@/lib/deprize/raceCardHeading'
import { goalIndexCategory, PROJECT_TYPE_LABEL } from '@/lib/lunar-atlas/display'
import { SEED_ATLAS } from '@/lib/lunar-atlas/seed'
import { sharedGoalById } from '@/lib/lunar-atlas/selectors'

const UI_ROOT = path.resolve(__dirname, '../../../../')

function readUi(...parts: string[]): string {
  return fs.readFileSync(path.join(UI_ROOT, ...parts), 'utf8')
}

describe('deprize index layout', () => {
  const index = readUi('components/deprize/DePrizeIndexContent.tsx')
  const card = readUi('components/deprize/RaceMarketCard.tsx')
  const icon = readUi('components/deprize/CategoryIcon.tsx')

  it('splits the index into Live and Planned sections', () => {
    expect(index).to.include('id="deprize-live-heading"')
    expect(index).to.include('id="deprize-planned-heading"')
    expect(index).to.include('liveRaces')
    expect(index).to.include('plannedRaces')
    expect(index).to.not.include("setListing('live')")
    expect(index).to.not.include("setListing('planned')")
    expect(index).to.include('id="deprize-intro"')
    expect(index).to.include('A DePrize is a market on who reaches a lunar capability first')
    expect(index).to.include('/moonbase?race=${rung.sharedGoalId}')
  })

  it('links each race card into Moonbase', () => {
    expect(card).to.include('See in Moonbase')
    expect(card).to.include('/moonbase?race=${goalId}')
  })

  it('keeps a status pill only when a market is paused or settled', () => {
    expect(card).to.include(
      "const showStatusPill = statusTone === 'paused' || statusTone === 'resolved'"
    )
    expect(card).to.not.include('No developer yet')
    expect(card).to.not.include('>Planning<')
  })

  it('draws the mass driver as an outline icon, not the magnet emoji', () => {
    expect(icon).to.include('function MagnetIcon')
    expect(icon).to.include('mass_driver: MagnetIcon')
    expect(icon).to.not.include('🧲')
  })

  it('splits an em-dash title and capitalizes the subtitle', () => {
    expect(
      raceCardHeading({
        id: 'shared-first-tracks',
        title: 'First Tracks — first commercial rover egress and drive',
      })
    ).to.deep.equal({
      name: 'First Tracks',
      subtitle: 'First commercial rover egress and drive',
    })
    expect(
      raceCardHeading({
        id: 'shared-ice',
        title: 'Water Ice — first published in-situ lunar surface water ice',
      }).subtitle
    ).to.match(/^First /)
  })

  it('uses the short name for a title with no dash', () => {
    expect(
      raceCardHeading({
        id: 'shared-mass-driver',
        title: 'First operational lunar mass driver',
      })
    ).to.deep.equal({
      name: 'Mass driver',
      subtitle: 'First operational lunar mass driver',
    })
  })

  it('files Water Ice under Prospecting and keeps it live on Sepolia', () => {
    const ice = sharedGoalById(SEED_ATLAS, 'shared-ice')
    expect(ice).to.exist
    expect(goalIndexCategory(ice!)).to.equal('prospecting')
    expect(PROJECT_TYPE_LABEL.prospecting).to.equal('Prospecting')
    expect(ice!.category).to.equal(undefined)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-ice')).to.equal(true)
    expect(isDePrizeGoalMarketBound('sepolia', 'shared-mass-driver')).to.equal(false)
  })
})
