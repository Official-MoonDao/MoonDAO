import { expect } from 'chai'
import {
  claimableCitizenshipMooney,
  mergeCitizenshipMooneyClaim,
} from '../lib/subscription/citizenshipMooneyClaim'

const stake = (
  amount: bigint,
  locked: boolean,
  txHash: string,
  blockNumber: number,
  logIndex: number
) => ({ amount, locked, txHash, blockNumber, logIndex })

const deposit = (amount: bigint, txHash: string, blockNumber: number, logIndex: number) => ({
  amount,
  txHash,
  blockNumber,
  logIndex,
})

describe('claimableCitizenshipMooney', () => {
  it('keeps an unlocked citizenship stake until the wallet locks it', () => {
    const stakes = [stake(BigInt(100), false, '0xmint', 10, 2)]
    expect(claimableCitizenshipMooney(stakes, [])).to.equal(BigInt(100))
    expect(claimableCitizenshipMooney(stakes, [deposit(BigInt(100), '0xlock', 11, 1)])).to.equal(
      BigInt(0)
    )
  })

  it('ignores a checkout lock and its deposit in the same transaction', () => {
    const stakes = [
      stake(BigInt(100), false, '0xmint', 10, 2),
      stake(BigInt(50), true, '0xrenew', 12, 4),
    ]
    const deposits = [deposit(BigInt(50), '0xrenew', 12, 3)]
    expect(claimableCitizenshipMooney(stakes, deposits)).to.equal(BigInt(100))
  })

  it('ignores deposits that happened before the citizenship stake', () => {
    expect(
      claimableCitizenshipMooney(
        [stake(BigInt(40), false, '0xmint', 10, 1)],
        [deposit(BigInt(40), '0xold', 9, 1)]
      )
    ).to.equal(BigInt(40))
  })

  it('reduces the claim when a later lock covers only part of it', () => {
    expect(
      claimableCitizenshipMooney(
        [stake(BigInt(100), false, '0xmint', 10, 1)],
        [deposit(BigInt(25), '0xpartial', 11, 1)]
      )
    ).to.equal(BigInt(75))
  })
})

describe('mergeCitizenshipMooneyClaim', () => {
  it('keeps the saved amount when the log read fails', () => {
    expect(
      mergeCitizenshipMooneyClaim({
        saved: BigInt(80),
        chainAmount: BigInt(0),
        chainOk: false,
        sawStake: false,
        balance: BigInt(80),
        ceiling: null,
      }).pending
    ).to.equal(BigInt(80))
  })

  it('clears a saved amount once logs show the stake was locked', () => {
    const merged = mergeCitizenshipMooneyClaim({
      saved: BigInt(80),
      chainAmount: BigInt(0),
      chainOk: true,
      sawStake: true,
      balance: BigInt(80),
      ceiling: null,
    })
    expect(merged.pending).to.equal(BigInt(0))
    expect(merged.clearSaved).to.equal(true)
  })

  it('hides MOONEY that was just locked until the deposit log catches up', () => {
    const merged = mergeCitizenshipMooneyClaim({
      saved: BigInt(0),
      chainAmount: BigInt(100),
      chainOk: true,
      sawStake: true,
      balance: BigInt(0),
      ceiling: BigInt(0),
    })
    expect(merged.pending).to.equal(BigInt(0))
    expect(merged.clearCeiling).to.equal(false)
  })

  it('keeps the remainder when logs come back empty', () => {
    const merged = mergeCitizenshipMooneyClaim({
      saved: BigInt(60),
      chainAmount: BigInt(0),
      chainOk: true,
      sawStake: false,
      balance: BigInt(60),
      ceiling: BigInt(60),
    })
    expect(merged.pending).to.equal(BigInt(60))
    expect(merged.clearCeiling).to.equal(false)
    expect(merged.clearSaved).to.equal(false)
  })

  it('trusts the chain once it falls to the remainder left after the lock', () => {
    const merged = mergeCitizenshipMooneyClaim({
      saved: BigInt(60),
      chainAmount: BigInt(60),
      chainOk: true,
      sawStake: true,
      balance: BigInt(60),
      ceiling: BigInt(60),
    })
    expect(merged.pending).to.equal(BigInt(60))
    expect(merged.clearCeiling).to.equal(true)
  })
})
