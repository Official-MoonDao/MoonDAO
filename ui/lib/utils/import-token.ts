import useContractConfig from '../../const/config'

declare let window: any

const tokenSymbol = 'MOONEY'
const tokenDecimals = 18
const tokenImage =
  'https://static.metaswap.codefi.network/api/v1/tokenIcons/1/0x20d4db1946859e2adb0e5acc2eac58047ad41395.png'

export function useImportToken() {
  const { MOONEYToken } = useContractConfig()

  async function importToken() {
    try {
      const wasAdded = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: MOONEYToken,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
            image: tokenImage,
          },
        },
      })
      if (wasAdded)
        localStorage.setItem(
          'MOONEY_isImported',
          JSON.stringify({ isImported: true })
        )
      return true
    } catch (error) {
      console.log(error)
      return false
    }
  }

  return importToken
}
