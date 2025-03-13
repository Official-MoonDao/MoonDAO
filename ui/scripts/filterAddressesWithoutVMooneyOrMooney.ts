const ERC20ABI = require('../const/abis/ERC20.json')
const VotingEscrowABI = require('../const/abis/VotingEscrow.json')
const { createThirdwebClient, getContract, readContract } = require('thirdweb')
const { arbitrum } = require('thirdweb/chains')
require('dotenv').config({ path: '../.env.local' })

const ADDRESSES: any[] = []

const MOONEY_ADDRESS = '0x1Fa56414549BdccBB09916f61f0A5827f779a85c'
const VMOONEY_ADDRESS = '0xB255c74F8576f18357cE6184DA033c6d93C71899'

const CHAIN = arbitrum
const chainSlug = 'arbitrum'

async function filterAddressesWithoutVMooneyOrMooney() {
  const client = createThirdwebClient({
    secretKey: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET,
  })

  const mooneyContract = getContract({
    client,
    address: MOONEY_ADDRESS,
    chain: CHAIN,
    abi: ERC20ABI,
  })

  const vMooneyContract = getContract({
    client,
    address: VMOONEY_ADDRESS,
    chain: CHAIN,
    abi: VotingEscrowABI,
  })

  const results = await Promise.all(
    ADDRESSES.map(async (address) => {
      const mooneyBalance = await readContract({
        contract: mooneyContract,
        method: 'balanceOf',
        params: [address],
      })
      const vMooneyBalance = await readContract({
        contract: vMooneyContract,
        method: 'balanceOf',
        params: [address],
      })

      return {
        address,
        hasNoTokens:
          mooneyBalance.toString() === '0' && vMooneyBalance.toString() === '0',
      }
    })
  )

  const addressesWithoutTokens = results
    .filter((result) => result.hasNoTokens)
    .map((result) => result.address)

  return addressesWithoutTokens
}

filterAddressesWithoutVMooneyOrMooney()
  .then((result) => {
    console.log(result.length, ADDRESSES.length)
  })
  .catch((error) => {
    console.error(error)
  })
