import { Chain } from 'thirdweb'

export async function getETHPrice(): Promise<number> {
  try {
    const response = await fetch(
      `https://api.etherscan.io/v2/api?module=stats&action=ethprice&chainId=1&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}`
    )
    const data = await response.json()
    if (data.message !== 'OK') throw new Error('Failed to fetch ETH price')
    const price = parseFloat(data.result?.ethusd)
    return isNaN(price) ? 0 : price
  } catch (error) {
    console.error('Failed to fetch ETH price:', error)
    return 0
  }
}

export async function fetchInternalTransactions(
  chain: Chain,
  treasuryAddress: string,
  startBlock: number = 0,
  endBlock: number = 99999999
): Promise<any[]> {
  try {
    const blockExplorer = chain.blockExplorers?.[0]
    if (!blockExplorer?.apiUrl) {
      console.warn('⚠️ No block explorer API URL configured for Arbitrum chain')
      return []
    }

    let allTransactions: any[] = []
    let page = 1
    const offset = 10000
    let hasMoreData = true

    while (hasMoreData) {
      const url = `${blockExplorer.apiUrl}&module=account&action=txlistinternal&address=${treasuryAddress}&startblock=${startBlock}&endblock=${endBlock}&page=${page}&offset=${offset}&sort=desc`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status === '0') {
        if (page === 1) {
          console.warn(`⚠️ Block explorer API returned error: ${data.message}`)
        }
        break
      }

      const transactions = data.result || []

      if (transactions.length === 0) {
        hasMoreData = false
      } else {
        allTransactions.push(...transactions)

        if (transactions.length < offset) {
          hasMoreData = false
        } else {
          page++
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      if (page > 10) {
        console.warn('⚠️ Reached maximum page limit (10), stopping pagination')
        break
      }
    }

    console.log(
      `✅ Fetched ${allTransactions.length} total internal transactions from block explorer across ${page} pages`
    )
    return allTransactions
  } catch (error) {
    console.error(
      '❌ Error fetching internal transactions from block explorer:',
      error
    )
    return []
  }
}
