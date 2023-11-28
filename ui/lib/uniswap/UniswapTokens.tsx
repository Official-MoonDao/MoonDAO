import { Ether, Token } from '@uniswap/sdk-core'
import { MOONEY_ADDRESSES } from '../../const/config'

export const ETH: any = Ether.onChain(1)

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
