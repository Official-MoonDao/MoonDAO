/// <reference types="node" />
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import { ownerNameFromRows, ownerNameStatement } from '@/lib/project/loadOwnerDisplayName'
import { toProjectOwnerId } from '@/lib/project/projectOwnerId'

describe('owner display name for Discord announcements', () => {
  it('reads a team name from the team table, not token metadata', () => {
    expect(ownerNameStatement('arbitrum', 23)).to.equal(
      'SELECT name FROM TEAMTABLE_42161_127 WHERE id = 23 LIMIT 1'
    )
    expect(
      ownerNameFromRows([{ name: 'U.S. Space & Rocket Center Education Foundation' }], 23)
    ).to.equal('U.S. Space & Rocket Center Education Foundation')
  })

  it('reads a project name from the project id, not the offset teamId', () => {
    expect(ownerNameStatement('arbitrum', toProjectOwnerId(5))).to.equal(
      'SELECT name FROM PROJECT_42161_122 WHERE id = 5 LIMIT 1'
    )
  })

  it('falls back when the row has no name, so the message never says undefined', () => {
    expect(ownerNameFromRows([], 23)).to.equal('Team 23')
    expect(ownerNameFromRows([{ name: '   ' }], 23)).to.equal('Team 23')
    expect(ownerNameFromRows([{ name: undefined }], 23)).to.equal('Team 23')
    expect(ownerNameFromRows([{ name: 'Orbital' }], toProjectOwnerId(5))).to.equal('Orbital')
    expect(ownerNameFromRows([], toProjectOwnerId(5))).to.equal('Project 5')
  })

  it('does not build a statement for a non-numeric id', () => {
    expect(ownerNameStatement('arbitrum', 'not-a-team')).to.equal(null)
    expect(ownerNameStatement('no-such-chain', 23)).to.equal(null)
  })
})

describe('job and listing Discord announcements', () => {
  const jobModal = fs.readFileSync(
    path.join(__dirname, '../components/subscription/TeamJobModal.tsx'),
    'utf8'
  )
  const listingModal = fs.readFileSync(
    path.join(__dirname, '../components/subscription/TeamMarketplaceListingModal.tsx'),
    'utf8'
  )

  it('loads the name from Tableland instead of NFT metadata', () => {
    for (const source of [jobModal, listingModal]) {
      expect(source).to.include('loadOwnerDisplayName')
      expect(source).to.not.include('getNFT')
      expect(source).to.not.include('metadata.name')
    }
  })
})
