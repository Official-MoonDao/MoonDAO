import { contractParams } from './zero-g-sweepstakes'

const openSeaMainnet = 'https://api.opensea.io/api/v1'
const openSeaTestnet = 'https://testnets-api.opensea.io/api/v1'

export async function getSweepstakesSupply() {
  try {
    const res = await fetch(
      `${openSeaTestnet}/assets?asset_contract_address=${contractParams.addressOrName}`
    )
    const data = await res.json()
    return `${data.assets.length}`
  } catch (err) {
    console.log(err)
  }
}
