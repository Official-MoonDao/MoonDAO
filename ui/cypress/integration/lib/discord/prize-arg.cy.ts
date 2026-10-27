import { expect } from 'chai'
import { findDePrizeIdForGoal } from '@/lib/deprize/competitions'
import {
  DEFAULT_DEPRIZE_CHAIN,
  DEFAULT_DEPRIZE_GOAL,
  defaultDePrizeId,
  parsePrizeArg,
} from '@/lib/discord/prizeArg'

describe('discord prize argument', () => {
  it('defaults to Touchdown on Arbitrum, not the Sepolia rehearsal', () => {
    expect(DEFAULT_DEPRIZE_CHAIN).to.equal('arbitrum')
    const id = defaultDePrizeId()
    expect(id).to.equal(findDePrizeIdForGoal('arbitrum', DEFAULT_DEPRIZE_GOAL))
    expect(id).to.be.a('number')
    expect(parsePrizeArg(undefined)).to.deep.equal({ ok: true, id })
    expect(parsePrizeArg('Touchdown')).to.deep.equal({ ok: true, id })
  })

  it('resolves "touchdown" per chain', () => {
    const sep = findDePrizeIdForGoal('sepolia', DEFAULT_DEPRIZE_GOAL)
    expect(parsePrizeArg('touchdown', 'sepolia')).to.deep.equal({ ok: true, id: sep })
  })

  it('passes numeric ids through and rejects anything else', () => {
    expect(parsePrizeArg(' 3 ')).to.deep.equal({ ok: true, id: 3 })
    expect(parsePrizeArg('night shift')).to.deep.equal({ ok: false })
    expect(parsePrizeArg('touchdown', 'nowhere')).to.deep.equal({ ok: false })
  })
})
