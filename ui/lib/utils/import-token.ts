import { MOONEY_ADDRESSES } from '../../const/config'
import { getChainSlug } from '../thirdweb/chain'

declare let window: any

const tokenSymbol = 'MOONEY'
const tokenDecimals = 18
const tokenImage =
  'https://static.metaswap.codefi.network/api/v1/tokenIcons/1/0x20d4db1946859e2adb0e5acc2eac58047ad41395.png'

export function useImportToken(selectedChain: any) {
  async function importToken() {
    try {
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: MOONEY_ADDRESSES[getChainSlug(selectedChain)],
            symbol: tokenSymbol,
            decimals: tokenDecimals,
            image: tokenImage,
          },
        },
      })
    } catch (error) {
      console.log(error)
      return false
    }
  }

  return importToken
}
