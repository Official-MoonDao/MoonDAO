import { expect } from 'chai'
import { CCTP_V2, USDC_ADDRESSES } from 'const/config'
import fs from 'fs'
import path from 'path'
import {
  addressToBytes32,
  BRIDGE_TOKENS,
  buildUsdcBurnCall,
  cctpForwardFeeUrl,
  formatUsdcUnits,
  parseUsdcUnits,
  protocolFeeUnits,
  quoteUsdcForwardBurn,
  selectFastForwardTier,
} from '../lib/bridge/usdcCctp'

const LIVE_FEE_RESPONSE = [
  {
    finalityThreshold: 1000,
    minimumFee: 1,
    forwardFee: { low: 71138, med: 73152, high: 75165 },
  },
  {
    finalityThreshold: 2000,
    minimumFee: 0,
    forwardFee: { low: 71138, med: 73152, high: 75165 },
  },
]

const NATIVE_ARBITRUM_USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
const BRIDGED_ARBITRUM_USDC_E = '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8'

describe('USDC bridge to Arbitrum', () => {
  const bridgeSource = fs.readFileSync(
    path.join(__dirname, '../components/bridge/ArbitrumBridge.tsx'),
    'utf8'
  )

  it('offers ETH, MOONEY, and USDC from one token list', () => {
    expect(BRIDGE_TOKENS.map((token) => token.id)).to.deep.equal(['eth', 'mooney', 'usdc'])
    expect(bridgeSource).to.include('BRIDGE_TOKENS')
    expect(bridgeSource).to.include('data-testid="bridge-token-select"')
    expect(bridgeSource).to.not.include("setInputToken(inputToken === 'eth' ? 'mooney' : 'eth')")
  })

  it('burns Ethereum USDC through CCTP so Arbitrum mints native USDC', () => {
    expect(USDC_ADDRESSES.ethereum.toLowerCase()).to.equal(
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    )
    expect(USDC_ADDRESSES.arbitrum.toLowerCase()).to.equal(NATIVE_ARBITRUM_USDC)
    expect(USDC_ADDRESSES.arbitrum.toLowerCase()).to.not.equal(BRIDGED_ARBITRUM_USDC_E)

    const recipient = '0x1111111111111111111111111111111111111111'
    const call = buildUsdcBurnCall({
      payAmount: 10_000_000n,
      maxFee: 76_165n,
      recipient,
    })

    expect(call.tokenMessenger).to.equal(CCTP_V2.tokenMessenger)
    expect(call.burnToken.toLowerCase()).to.equal(USDC_ADDRESSES.ethereum.toLowerCase())
    expect(call.destinationUsdc.toLowerCase()).to.equal(NATIVE_ARBITRUM_USDC)
    expect(call.args[0]).to.equal('10000000')
    expect(call.args[1]).to.equal(3)
    expect(call.args[2]).to.equal(addressToBytes32(recipient))
    expect(call.args[3].toLowerCase()).to.equal(USDC_ADDRESSES.ethereum.toLowerCase())
    expect(call.args[4]).to.equal(`0x${'0'.repeat(64)}`)
    expect(call.args[5]).to.equal('76165')
    expect(call.args[6]).to.equal(1000)
    expect(call.args[7]).to.equal(CCTP_V2.forwardHookData)
    expect(bridgeSource).to.include('depositForBurnWithHook')
    expect(bridgeSource).to.include('buildUsdcBurnCall')
  })

  it('requests the Ethereum to Arbitrum forwarding fee', () => {
    expect(cctpForwardFeeUrl()).to.equal(
      'https://iris-api.circle.com/v2/burn/USDC/fees/0/3?forward=true'
    )
  })

  it('parses the fast tier and ignores the standard tier', () => {
    const tier = selectFastForwardTier(LIVE_FEE_RESPONSE)
    expect(tier?.finalityThreshold).to.equal(1000)
    expect(tier?.minimumFeeBps).to.equal(1)
    expect(tier?.forwardFee.high).to.equal(75165n)

    expect(
      selectFastForwardTier({
        finalityThreshold: 2000,
        minimumFee: 0,
        forwardFee: { low: 1, med: 1, high: 1 },
      })
    ).to.equal(null)
    expect(selectFastForwardTier({ finalityThreshold: 1000, minimumFee: 1 })).to.equal(null)
  })

  it('quotes a fee taken out of the amount the user pays', () => {
    const tier = selectFastForwardTier(LIVE_FEE_RESPONSE)
    if (!tier) throw new Error('missing tier')
    const quote = quoteUsdcForwardBurn(10_000_000n, tier, 'high')
    expect(quote?.protocolFee).to.equal(1000n)
    expect(quote?.forwardFee).to.equal(75165n)
    expect(quote?.maxFee).to.equal(76165n)
    expect(quote?.receiveAmount).to.equal(9_923_835n)
    expect(formatUsdcUnits(quote!.receiveAmount)).to.equal('9.923835')
  })

  it('refuses an amount that cannot cover the forwarding fee', () => {
    const tier = selectFastForwardTier(LIVE_FEE_RESPONSE)
    if (!tier) throw new Error('missing tier')
    expect(quoteUsdcForwardBurn(50_000n, tier)).to.equal(null)
    expect(quoteUsdcForwardBurn(0n, tier)).to.equal(null)
  })

  it('rounds the protocol fee up for fractional basis points', () => {
    expect(protocolFeeUnits(10_000_000n, 1.3)).to.equal(1300n)
    expect(protocolFeeUnits(1n, 1)).to.equal(1n)
    expect(protocolFeeUnits(10_000_000n, 0)).to.equal(0n)
  })

  it('parses USDC amounts at 6 decimals and floors extra places', () => {
    expect(parseUsdcUnits('1.5')).to.equal(1_500_000n)
    expect(parseUsdcUnits('1.1234567')).to.equal(1_123_456n)
    expect(parseUsdcUnits('0.0000004')).to.equal(0n)
    expect(parseUsdcUnits('10')).to.equal(10_000_000n)
    expect(parseUsdcUnits('')).to.equal(null)
    expect(parseUsdcUnits('1e6')).to.equal(null)
    expect(parseUsdcUnits('-1')).to.equal(null)
    expect(formatUsdcUnits(1_500_000n)).to.equal('1.5')
    expect(formatUsdcUnits(0n)).to.equal('0')
  })

  it('pads the mint recipient to 32 bytes', () => {
    expect(addressToBytes32('0xAbCDEFabcdefABCDEFabcdefABCDEFabcdefABCD')).to.equal(
      '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd'
    )
    expect(() => addressToBytes32('0x1234')).to.throw('Invalid mint recipient')
  })
})
