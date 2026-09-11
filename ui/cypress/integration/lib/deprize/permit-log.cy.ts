import { getAddress } from 'viem'
import { acceptanceHistoryKey, acceptanceLatestKey } from '@/lib/deprize/acceptanceLog'
import {
  DEFAULT_PERMIT_TTL_SECONDS,
  hashCompliancePermit,
  permitTtlSeconds,
} from '@/lib/deprize/compliancePermit'
import {
  PERMIT_MATCH_CLOCK_SKEW_SECONDS,
  buildPermitIssuanceRecord,
  permitByHashKey,
  permitCoversBet,
  permitRecordKey,
} from '@/lib/deprize/permitLog'

const wallet = getAddress('0x1234567890123456789012345678901234567890')
const mintAddress = getAddress('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')

const attestations = {
  notUsResident: true,
  notUsEntityOrRepresentative: true,
  notInsiderOrProxy: true,
}

describe('deprize compliance records', () => {
  it('uses append-only acceptance keys', () => {
    expect(acceptanceLatestKey(wallet, '1.1')).to.equal(
      `deprize:accept:latest:${wallet.toLowerCase()}:1.1`
    )
    expect(acceptanceHistoryKey(wallet)).to.equal(`deprize:accept:history:${wallet.toLowerCase()}`)
  })

  it('defaults the permit TTL to 120 seconds', () => {
    expect(DEFAULT_PERMIT_TTL_SECONDS).to.equal(120)
    const previous = process.env.DEPRIZE_PERMIT_TTL_SECONDS
    delete process.env.DEPRIZE_PERMIT_TTL_SECONDS
    expect(permitTtlSeconds()).to.equal(120)
    if (previous === undefined) delete process.env.DEPRIZE_PERMIT_TTL_SECONDS
    else process.env.DEPRIZE_PERMIT_TTL_SECONDS = previous
  })

  it('stores a permit hash that matches hashCompliancePermit', () => {
    const args = {
      wallet,
      deprizeId: 1n,
      deadline: 1_800_000_000n,
      chainId: 42161,
      mintAddress,
    }
    const record = buildPermitIssuanceRecord({
      ...args,
      issuedAt: '2026-09-11T18:00:00.000Z',
      country: 'CH',
      region: null,
      ipHash: 'abcd1234abcd1234',
      connectionKind: 'relay',
      eligibilityReason: 'ok',
      termsVersion: '1.1',
      attestations,
    })
    expect(record.permitHash).to.equal(hashCompliancePermit(args))
    expect(permitByHashKey(record.permitHash)).to.equal(
      `deprize:permit:by-hash:${record.permitHash.toLowerCase()}`
    )
    expect(permitRecordKey(record.recordId)).to.equal(`deprize:permit:record:${record.recordId}`)
  })

  it('matches a bet only inside the issued permit window', () => {
    const issuedAt = '2026-09-11T18:00:00.000Z'
    const issuedAtSec = Math.floor(Date.parse(issuedAt) / 1000)
    const record = {
      wallet,
      deprizeId: 1,
      chainId: 42161,
      issuedAt,
      deadline: String(issuedAtSec + 120),
    }
    expect(
      permitCoversBet({
        record,
        wallet,
        deprizeId: 1,
        chainId: 42161,
        blockTimestampSec: issuedAtSec + 30,
      })
    ).to.equal(true)
    expect(
      permitCoversBet({
        record,
        wallet,
        deprizeId: 1,
        chainId: 42161,
        blockTimestampSec: issuedAtSec - 30,
      })
    ).to.equal(true)
    expect(
      permitCoversBet({
        record,
        wallet,
        deprizeId: 1,
        chainId: 42161,
        blockTimestampSec: issuedAtSec - PERMIT_MATCH_CLOCK_SKEW_SECONDS - 1,
      })
    ).to.equal(false)
    expect(
      permitCoversBet({
        record,
        wallet,
        deprizeId: 2,
        chainId: 42161,
        blockTimestampSec: issuedAtSec + 30,
      })
    ).to.equal(false)
    expect(
      permitCoversBet({
        record,
        wallet,
        deprizeId: 1,
        chainId: 42161,
        blockTimestampSec: Number(record.deadline) + 1,
      })
    ).to.equal(false)
  })
})
