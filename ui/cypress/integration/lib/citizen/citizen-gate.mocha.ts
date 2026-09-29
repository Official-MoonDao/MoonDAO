/// <reference types="node" />
import fs from 'fs'
import path from 'path'
import { classifyCitizenProbes, isNoTokenOwnedError } from '@/lib/citizen/citizenGate'

const UI_ROOT = path.resolve(__dirname, '../../../../')

describe('prize-chain citizen gate', () => {
  const linked = '0x679d87d8640e66778c3419d164998e720d7495f6'

  it('treats the active wallet as the signer that can predict', () => {
    expect(
      classifyCitizenProbes({
        active: 'citizen',
        others: [{ address: linked, status: 'none' }],
      })
    ).to.deep.equal({ isCitizen: true, lookupFailed: false, expired: false })
  })

  it('points at a linked wallet that holds the Citizen', () => {
    expect(
      classifyCitizenProbes({
        active: 'none',
        others: [
          { address: '0x0000000000000000000000000000000000000001', status: 'none' },
          { address: linked, status: 'citizen' },
        ],
      })
    ).to.deep.equal({
      isCitizen: false,
      lookupFailed: false,
      expired: false,
      linkedCitizenAddress: linked,
    })
  })

  it('does not hide a failed signer read behind a lapsed linked wallet', () => {
    expect(
      classifyCitizenProbes({
        active: 'error',
        others: [{ address: linked, status: 'expired' }],
      })
    ).to.deep.equal({ isCitizen: false, lookupFailed: true, expired: false })
  })

  it('does not tell someone to mint when the read failed', () => {
    expect(
      classifyCitizenProbes({
        active: 'error',
        others: [],
      }).lookupFailed
    ).to.equal(true)
    expect(
      classifyCitizenProbes({
        active: 'none',
        others: [{ address: linked, status: 'error' }],
      }).lookupFailed
    ).to.equal(true)
  })

  it('keeps a lapsed subscription distinct from minting', () => {
    expect(classifyCitizenProbes({ active: 'expired', others: [] })).to.deep.equal({
      isCitizen: false,
      lookupFailed: false,
      expired: true,
    })
    expect(
      classifyCitizenProbes({
        active: 'none',
        others: [{ address: linked, status: 'expired' }],
      }).linkedCitizenAddress
    ).to.equal(linked)
  })

  it('asks a wallet with no Citizen to mint', () => {
    const gate = classifyCitizenProbes({
      active: 'none',
      others: [{ address: linked, status: 'none' }],
    })
    expect(gate).to.deep.equal({ isCitizen: false, lookupFailed: false, expired: false })
  })

  it('recognizes the contract revert nested on the error cause', () => {
    expect(isNoTokenOwnedError(new Error('execution reverted'))).to.equal(false)
    expect(isNoTokenOwnedError({ message: 'call failed', cause: { reason: 'No token owned' } })).to.equal(
      true
    )
  })

  it('ForecastPanel explains a Citizen on another wallet instead of only offering mint', () => {
    const panel = fs.readFileSync(
      path.join(UI_ROOT, 'components/deprize/ForecastPanel.tsx'),
      'utf8'
    )
    const notice = fs.readFileSync(
      path.join(UI_ROOT, 'components/deprize/CitizenPredictNotice.tsx'),
      'utf8'
    )
    expect(panel).to.include('usePrizeChainCitizen')
    expect(panel).to.include('CitizenPredictNotice')
    expect(notice).to.include('Switch to that wallet')
    expect(notice).to.include('check your Citizen')
    expect(notice).to.include('Mint a Citizen')
  })
})
