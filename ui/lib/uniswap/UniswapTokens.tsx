import { Ether, Token, NativeCurrency } from '@uniswap/sdk-core'
import { WMATIC_POLYGON } from '@uniswap/smart-order-router'
import { MOONEY_ADDRESSES } from '../../const/config'

export const ETH: any = Ether.onChain(1)

export const MATIC = WMATIC_POLYGON

export const MOONEY = new Token(
  1,
  MOONEY_ADDRESSES['ethereum'],
  18,
  'MOONEY',
  'MOONEY'
)

export const L2_MOONEY = new Token(
  137,
  MOONEY_ADDRESSES['polygon'],
  18,
  'MOONEY',
  'MOONEY (PoS)'
)

export const DAI = new Token(
  1,
  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  18,
  'DAI',
  'DAI Stablecoin'
)
