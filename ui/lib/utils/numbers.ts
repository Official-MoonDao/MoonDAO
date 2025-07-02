import { BigNumber, BigNumberish, ethers } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'

export function stringToNumber(string: any, decimals: any) {
  return Number(string).toFixed(decimals)
}

export function truncateTokenValue(value: number | string, token: string) {
  let truncatedValue
  const decimalPlaces = value.toString().split('.')[1]?.length || 0
  if (token === 'ETH') {
    truncatedValue = Number(value).toFixed(Math.min(decimalPlaces, 5))
  } else if (
    token === 'USDC' ||
    token === 'USDT' ||
    token === 'DAI' ||
    token === 'MOONEY'
  ) {
    truncatedValue = Number(value).toFixed(Math.min(decimalPlaces, 2))
  } else {
    truncatedValue = Number(value)
  }
  const numericValue = parseFloat(String(truncatedValue))
  return formatNumberWithCommas(numericValue.toString())
}

export enum NumberType {
  number = 'number',
  bignumber = 'bignumber',
  string = 'string',
}

// Utility function to format numbers with commas
export function formatNumberWithCommas(numStr: string): string {
  const [integerPart, decimalPart] = numStr.split('.')
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger
}

export function transformNumber(
  num: number | BigNumber | string,
  to: NumberType,
  decimals = 18
): BigNumber | string | number {
  if (!num) {
    return to === NumberType.bignumber ? ethers.BigNumber.from('0') : 0
  }

  if (to === NumberType.bignumber) {
    if (num instanceof ethers.BigNumber) return num

    return ethers.utils.parseUnits(
      typeof num === 'string' ? num : num.toString(),
      decimals
    )
  } else if (to === NumberType.number) {
    if (typeof num === 'number') return num

    if (num instanceof ethers.BigNumber) {
      return stringToNumber(ethers.utils.formatUnits(num, 18), decimals)
    } else if (typeof num === 'string') {
      return parseFloat(num).toFixed(decimals)
    }
  } else if (to === NumberType.string) {
    if (typeof num === 'string') return formatNumberWithCommas(num)

    if (num instanceof ethers.BigNumber) {
      const formattedNum = stringToNumber(
        ethers.utils.formatUnits(num, 18),
        decimals
      ).toString()
      return formatNumberWithCommas(formattedNum)
    } else if (typeof num === 'number') {
      const formattedNum = num.toFixed(decimals).toString()
      return formatNumberWithCommas(formattedNum)
    }
  }
  return 0
}

export const fromWad = (wadValue?: BigNumberish) => {
  const result = formatUnits(wadValue ?? '0')
  return result.substring(result.length - 2) === '.0'
    ? result.substring(0, result.length - 2)
    : result
}

export const wadToFloat = (wadValue?: BigNumberish) => {
  return parseFloat(fromWad(wadValue))
}
