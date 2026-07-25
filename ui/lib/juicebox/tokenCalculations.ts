import { FixedInt } from 'fpnum'
import { getTokenAToBQuote, ReservedPercent, RulesetWeight } from 'juice-sdk-core'

/**
 * Convert to bigint, tolerating JS numbers in scientific notation. Juicebox
 * weights are typically 1e21, whose Number#toString() is "1e+21" — a string
 * BigInt() rejects with "Cannot convert 1e+21 to a BigInt".
 */
function toBigIntSafe(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return BigInt(0)
    if (Number.isSafeInteger(value)) return BigInt(value)
    // Large numbers (beyond 2^53) stringify in exponent form; toLocaleString
    // with fullwide renders all digits instead.
    return BigInt(
      value.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 })
    )
  }
  const str = value.trim()
  if (/e/i.test(str)) return toBigIntSafe(Number(str))
  return BigInt(str)
}

export function calculateTokensFromPayment(
  paymentAmount: string | bigint,
  ruleset: readonly any[]
): string {
  if (!paymentAmount || !ruleset || !ruleset[0] || !ruleset[1]) return '0'

  try {
    const payment = new FixedInt(toBigIntSafe(paymentAmount), 18)

    const weightValue = toBigIntSafe(ruleset[0].weight)
    const reservedPercentValue = toBigIntSafe(ruleset[1].reservedPercent)
    
    const weight = new RulesetWeight(weightValue)
    const reservedPercent = new ReservedPercent(Number(reservedPercentValue))

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
