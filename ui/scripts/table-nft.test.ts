/// <reference types="node" />
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import { toProjectOwnerId } from '@/lib/project/projectOwnerId'
import {
  citizenByOwnerStatement,
  ownerNftFromRows,
  ownerProfileStatement,
  projectActiveFromRows,
  projectRowToNFT,
  teamNameMapFromRows,
  teamNamesStatement,
} from '@/lib/tableland/tableNft'

const ROOT = path.join(__dirname, '..')

describe('table NFT profiles', () => {
  it('reads a team profile from the team table', () => {
    expect(ownerProfileStatement('arbitrum', 23)).to.equal(
      'SELECT * FROM TEAMTABLE_42161_127 WHERE id = 23 LIMIT 1'
    )
    const nft = ownerNftFromRows(
      [
        {
          id: 23,
          name: 'U.S. Space & Rocket Center Education Foundation',
          description: 'Space Camp',
          image: 'ipfs://QmPz',
          website: 'https://rocketcenterfoundation.org/',
          communications: 'https://www.linkedin.com/company/example',
          twitter: '',
          view: 'public',
          formId: 'abc',
        },
      ],
      23
    )
    expect(nft.metadata.name).to.equal('U.S. Space & Rocket Center Education Foundation')
    expect(nft.metadata.image).to.equal('ipfs://QmPz')
    expect(
      nft.metadata.attributes.find((attr: any) => attr.trait_type === 'twitter')?.value
    ).to.equal('')
    expect(
      nft.metadata.attributes.find((attr: any) => attr.trait_type === 'communications')?.value
    ).to.equal('https://www.linkedin.com/company/example')
  })

  it('reads a project profile, including the active flag, from the project id', () => {
    expect(ownerProfileStatement('arbitrum', toProjectOwnerId(5))).to.equal(
      'SELECT * FROM PROJECT_42161_122 WHERE id = 5 LIMIT 1'
    )
    const nft = projectRowToNFT({ id: 5, name: 'Orbital', image: 'ipfs://Qm', MDP: 12, active: 2 })
    expect(nft.metadata.name).to.equal('Orbital')
    expect(nft.metadata.attributes.find((attr: any) => attr.trait_type === 'MDP')?.value).to.equal(
      12
    )
    expect(projectActiveFromRows([{ active: 2 }])).to.equal('active')
    expect(projectActiveFromRows([{ active: 0 }])).to.equal('inactive')
    expect(projectActiveFromRows([])).to.equal('inactive')
    expect(projectActiveFromRows(null)).to.equal('unknown')
  })

  it('batches team names and rejects ids or addresses that are not safe in SQL', () => {
    expect(teamNamesStatement('arbitrum', [23, 23, 4])).to.equal(
      'SELECT id, name FROM TEAMTABLE_42161_127 WHERE id IN (23,4)'
    )
    expect(teamNameMapFromRows([{ id: 23, name: '  Space Camp  ' }]).get('23')).to.equal(
      'Space Camp'
    )
    expect(ownerProfileStatement('arbitrum', 'not-a-team')).to.equal(null)
    expect(citizenByOwnerStatement('arbitrum', "0x' OR 1=1 --")).to.equal(null)
    const address = '0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002'
    expect(citizenByOwnerStatement('arbitrum', address)).to.include(
      `LOWER(owner) = '${address.toLowerCase()}'`
    )
  })
})

describe('metadata readers no longer call getNFT', () => {
  const files = [
    'lib/project/useOwnerNFT.tsx',
    'lib/project/isOwnerActive.ts',
    'lib/citizen/useCitizen.tsx',
    'lib/team/fetchTeamServerData.ts',
    'lib/thirdweb/waitForERC721.ts',
    'components/project/AuthorCitizenLink.tsx',
    'components/subscription/TeamListing.tsx',
    'components/subscription/BuyTeamListingModal.tsx',
    'components/hats/Hat.tsx',
    'components/layout/account/UserTeamsList.tsx',
    'components/mission/MissionCard.tsx',
    'components/mission/MissionWideCard.tsx',
    'components/mission/MissionProfile.tsx',
    'components/mission/CreateMission.tsx',
    'components/deprize/DePrizeTeamLink.tsx',
    'components/nance/CompetitorPreview.tsx',
  ]

  for (const file of files) {
    it(file, () => {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
      expect(source).to.not.include("from 'thirdweb/extensions/erc721'")
    })
  }
})
