import { FixedInt } from 'fpnum'
import { getTokenAToBQuote, ReservedPercent, RulesetWeight } from 'juice-sdk-core'

export function calculateTokensFromPayment(
  paymentAmount: string | bigint,
  ruleset: readonly any[]
): string {
  if (!paymentAmount || !ruleset || !ruleset[0] || !ruleset[1]) return '0'

  try {
    const payment = new FixedInt(BigInt(paymentAmount.toString()), 18)
    const weight = new RulesetWeight(ruleset[0].weight)
    const reservedPercent = new ReservedPercent(ruleset[1].reservedPercent)

    const quote = getTokenAToBQuote(payment, {
      weight,
      reservedPercent,
    })
    return formatTokenAmount(quote.payerTokens.toString(), 18)
  } catch (error) {
    console.error('Error calculating tokens from payment:', error)
    return '0'
  }
}

export function calculateRedeemValue(
  tokenAmount: string | bigint,
  totalSupply: string | bigint,
  treasuryBalance: string | bigint,
  redemptionRate: number = 10000
): string {
  if (!tokenAmount || !totalSupply || !treasuryBalance) return '0'

  try {
    const tokens = BigInt(tokenAmount.toString())
    const supply = BigInt(totalSupply.toString())
    const treasury = BigInt(treasuryBalance.toString())
    const ZERO = BigInt(0)
    const TEN_THOUSAND = BigInt(10000)

    if (supply === ZERO || tokens === ZERO) return '0'

    // Calculate proportional share: (tokens / totalSupply) * treasury
    // Apply redemption rate: result * (redemptionRate / 10000)
    const proportionalShare = (tokens * treasury) / supply
    const redeemValue = (proportionalShare * BigInt(redemptionRate)) / TEN_THOUSAND

    // Convert to readable format (divide by 1e18 for wei to ETH)
    const ethValue = Number(redeemValue) / 1e18

    return ethValue.toString()
  } catch (error) {
    console.error('Error calculating redeem value:', error)
    return '0'
  }
}

export function formatTokenAmount(tokenAmount: string | bigint, decimals: number = 18): string {
  if (!tokenAmount) return '0'

  try {
    const amount = BigInt(tokenAmount.toString())
    const divisor = BigInt(10 ** decimals)
    const integerPart = amount / divisor
    const fractionalPart = amount % divisor
    const ZERO = BigInt(0)

    if (fractionalPart === ZERO) {
      return integerPart.toString()
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
    // Remove trailing zeros
    const trimmedFractional = fractionalStr.replace(/0+$/, '')

    return `${integerPart}.${trimmedFractional}`
  } catch (error) {
    console.error('Error formatting token amount:', error)
    return '0'
  }
}
