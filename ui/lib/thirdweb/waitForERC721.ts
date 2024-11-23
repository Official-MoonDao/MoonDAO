//Wait for nft metadata to populate
export default async function waitForERC721(
  contract: any,
  tokenId: string | number
) {
  if (!contract?.erc721) {
    throw new Error('Invalid contract')
  }

  let attemps = 0
  const maxAttempts = 20
  const timeout = 3000

  while (attemps < maxAttempts) {
    const nft = await contract.erc721.get(tokenId)
    if (
      nft?.metadata.name !== '' &&
      nft?.metadata.name !== 'Failed to load NFT metadata'
    ) {
      return nft
    }
    await new Promise((resolve) => setTimeout(resolve, timeout))
    attemps++
  }

  throw new Error(
    `Failed to fetch NFT after ${(maxAttempts * timeout) / 1000} seconds`
  )
}
