import { computeContributionMaxUsd } from '@/lib/mission/computeContributionMaxUsd'
import {
  applyFeeOverrides,
  computeMaxFeePerGas,
  feesFromProviderSnapshot,
  hasFeeValue,
  parseGasPriceApiPayload,
} from '@/lib/rpc/eip1559Fees'
import { L2_GAS_BUDGET_ETH, L2_GAS_BUDGET_WEI } from '@/lib/rpc/gasBudget'
import {
  buildSafeExecutionOptions,
  encodeExecTransactionData,
  estimateSafeExecutionGas,
  minGasLimitForSafeTxGas,
  resolveSafeExecutionGasLimit,
} from '@/lib/safe/executionGas'

// Reported production failure:
// insufficient funds for gas * price + value
// have 93794013200000 want 120084000000000
const HAVE_WEI = 93794013200000n
const WANT_WEI = 120084000000000n
// 2_000_000 gas * 3 * 20_014_000 wei = 120_084_000_000_000
const ARBITRUM_GAS_PRICE_WEI = 20_014_000n

describe('L2 gas budget', () => {
  it('is larger than the observed wallet lock and the failed balance', () => {
    expect(L2_GAS_BUDGET_WEI > WANT_WEI).to.equal(true)
    expect(L2_GAS_BUDGET_WEI > HAVE_WEI).to.equal(true)
    expect(L2_GAS_BUDGET_ETH).to.be.closeTo(0.00025, 1e-12)
  })
})

describe('EIP-1559 fee math', () => {
  it('uses 2.4× base + priority', () => {
    expect(computeMaxFeePerGas(10n, 2n)).to.equal(26n)
  })

  it('prefers block base fee over inflated provider maxFee', () => {
    const fees = feesFromProviderSnapshot(
      {
        maxFeePerGas: 1_000_000_000n,
        maxPriorityFeePerGas: 0n,
        gasPrice: ARBITRUM_GAS_PRICE_WEI,
      },
      { baseFeePerGas: ARBITRUM_GAS_PRICE_WEI }
    )
    expect(fees.maxFeePerGas).to.equal(computeMaxFeePerGas(ARBITRUM_GAS_PRICE_WEI, 0n))
    expect(fees.maxFeePerGas < 1_000_000_000n).to.equal(true)
  })

  it('parses the gas-price API payload', () => {
    const parsed = parseGasPriceApiPayload({
      maxFeePerGas: '0x2e90edd',
      maxPriorityFeePerGas: '0x1',
    })
    expect(parsed?.maxFeePerGas).to.equal(0x2e90eddn)
    expect(parsed?.maxPriorityFeePerGas).to.equal(1n)
  })

  it('treats a 0 tip as present and recovers maxFee from baseFee', () => {
    expect(hasFeeValue(0n)).to.equal(true)
    expect(hasFeeValue(undefined)).to.equal(false)
    const parsed = parseGasPriceApiPayload({
      baseFeePerGas: '0x1312d00',
      maxPriorityFeePerGas: '0x0',
    })
    expect(parsed?.maxPriorityFeePerGas).to.equal(0n)
    expect(parsed?.maxFeePerGas).to.equal(computeMaxFeePerGas(0x1312d00n, 0n))
  })

  it('stamps API fees onto a prepared tx', () => {
    const decorated = applyFeeOverrides(
      { to: '0x1', gas: 200000n, maxFeePerGas: 1_000_000_000n },
      { maxFeePerGas: 48_033_600n, maxPriorityFeePerGas: 0n }
    )
    expect(decorated.maxFeePerGas).to.equal(48_033_600n)
    expect(decorated.gas).to.equal(200000n)
  })
})

describe('Safe execution gas', () => {
  it('reproduces the reported want amount from the old 2M * 3x gasPrice lock', () => {
    const oldWant = 2_000_000n * 3n * ARBITRUM_GAS_PRICE_WEI
    expect(oldWant).to.equal(WANT_WEI)
    expect(HAVE_WEI < oldWant).to.equal(true)
  })

  it('falls back well below the reported wallet balance', () => {
    const gasLimit = resolveSafeExecutionGasLimit({ isRejectionTx: false })
    const maxFee = computeMaxFeePerGas(ARBITRUM_GAS_PRICE_WEI, 0n)
    const reserved = gasLimit * maxFee
    expect(reserved < HAVE_WEI).to.equal(true)
    expect(reserved < WANT_WEI).to.equal(true)
  })

  it('buffers an estimate without returning to the 2M default', () => {
    const gasLimit = resolveSafeExecutionGasLimit({
      estimatedGas: 200_000n,
      isRejectionTx: false,
    })
    expect(gasLimit).to.equal(300_000n)
  })

  it('builds string options the Safe SDK accepts', () => {
    const options = buildSafeExecutionOptions({
      isRejectionTx: false,
      maxFeePerGas: 48_033_600n,
      maxPriorityFeePerGas: 0n,
    })
    expect(options.gasLimit).to.equal('500000')
    expect(options.maxFeePerGas).to.equal('48033600')
  })

  it('floors the outer limit so a queued 1M safeTxGas cannot GS010', () => {
    const floor = minGasLimitForSafeTxGas(1_000_000n)
    expect(floor > 1_000_000n).to.equal(true)
    const limit = resolveSafeExecutionGasLimit({
      isRejectionTx: false,
      safeTxGas: 1_000_000n,
    })
    expect(limit).to.equal(floor)
    const reserved = limit * computeMaxFeePerGas(ARBITRUM_GAS_PRICE_WEI, 0n)
    expect(reserved < HAVE_WEI).to.equal(true)
  })

  it('encodes execTransaction and estimates via the provider', async () => {
    const owner = '0x1111111111111111111111111111111111111111'
    const safeTx = {
      to: '0x2222222222222222222222222222222222222222',
      value: '0',
      data: '0xabcdef',
      operation: 0,
      safeTxGas: '0',
      baseGas: '0',
      gasPrice: '0',
      gasToken: '0x0000000000000000000000000000000000000000',
      refundReceiver: '0x0000000000000000000000000000000000000000',
      confirmations: [
        { owner, signature: '0x' + 'ab'.repeat(65) },
      ],
    }
    const encoded = encodeExecTransactionData(safeTx)
    expect(encoded.slice(0, 10)).to.equal('0x6a761202')

    let seen: {
      to?: string
      data?: string
      from?: string
      maxFeePerGas?: string
    } = {}
    const estimated = await estimateSafeExecutionGas({
      safe: {
        getAddress: async () => '0x3333333333333333333333333333333333333333',
      },
      safeTx,
      maxFeePerGas: 48_033_600n,
      maxPriorityFeePerGas: 0n,
      provider: {
        getSigner: () => ({
          getAddress: async () => owner,
        }),
        estimateGas: async (tx) => {
          seen = tx
          return { toString: () => '220000' }
        },
      },
    })
    expect(estimated).to.equal(220000n)
    expect(seen.to).to.equal('0x3333333333333333333333333333333333333333')
    expect(seen.from).to.equal(owner)
    expect(seen.data).to.equal(encoded)
    expect(seen.maxFeePerGas).to.equal('48033600')
  })
})

describe('computeContributionMaxUsd L2 reserve', () => {
  it('leaves the shared L2 budget behind on Arbitrum', () => {
    const maxUsd = computeContributionMaxUsd({
      balanceWei: 10n ** 16n, // 0.01 ETH
      selectedChainId: 42161,
      chainSlug: 'arbitrum',
      defaultChainSlug: 'arbitrum',
      ethUsdPrice: 3000,
    })
    // (0.01 - 0.00025) ETH * $3000 = $29.25
    expect(maxUsd).to.equal(29.25)
  })

  it('does not treat 0.00015 ETH as spendable (old 0.0001 reserve would have)', () => {
    expect(
      computeContributionMaxUsd({
        balanceWei: 150000000000000n,
        selectedChainId: 42161,
        chainSlug: 'arbitrum',
        defaultChainSlug: 'arbitrum',
        ethUsdPrice: 3000,
      })
    ).to.equal(null)
  })
})
