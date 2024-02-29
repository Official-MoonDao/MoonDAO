import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { NFT } from '@thirdweb-dev/sdk'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { pinMetadataToIPFS } from '../ipfs/pin'
import PrivyWalletContext from '../privy/privy-wallet-context'

function getAttribute(attributes: any[], traitType: string) {
  return Object.values(attributes).find(
    (attr: any) => attr.trait_type === traitType
  )
}

export function useEntityMetadata(entityContract: any, nft: any) {
  const address = useAddress()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [members, setMembers] = useState<string[]>()
  const [multisigAddress, setMultisigAddress] = useState<any>()
  const [socials, setSocials] = useState<any>()

  function getMultisigAddress() {
    const entityMultisigAddress = getAttribute(
      nft.metadata.attributes,
      'multisig'
    )
    setMultisigAddress(entityMultisigAddress.value)
  }

  function getEntitySocials() {
    const entityTwitter = getAttribute(nft.metadata.attributes, 'twitter')
    const entityDiscord = getAttribute(nft.metadata.attributes, 'discord')
    const entityTelegram = getAttribute(nft.metadata.attributes, 'telegram')
    const entityWebsite = getAttribute(nft.metadata.attributes, 'website')
    setSocials({
      twitter: entityTwitter?.value,
      discord: entityDiscord?.value,
      telegram: entityTelegram?.value,
      website: entityWebsite?.value,
    })
  }

  function getEntityMembers() {
    if (!nft?.metadata?.attributes) return
    const entityMembers: any = Object.values(nft.metadata.attributes).find(
      (attr: any) => attr.trait_type === 'members'
    )
    setMembers(entityMembers.value.split(','))
  }

  async function updateEntityMembers(newMembers: string[]) {
    if (address != multisigAddress)
      return toast.error(`Connect the entity's safe to update members`)

    const provider = await wallets[selectedWallet].getEthersProvider()

    const signer = provider?.getSigner()

    const message = `Please sign this message to update this entity's members`

    const signature = await signer?.signMessage(message)

    if (!signature) return toast.error('Error signing message')

    const jwtRes = await fetch('/api/ipfs/upload', {
      method: 'POST',
      headers: {
        signature,
      },
      body: JSON.stringify({ address, message }),
    })

    const JWT = await jwtRes.text()

    const metadata = {
      name: `Entity #${nft.metadata.tokenId}`,
      description: `MoonDAO Entity : ${nft.metadata.name}`,
      image: nft.metadata.image,
      attributes: [
        {
          trait_type: 'multisig',
          value: multisigAddress,
        },
        {
          trait_type: 'members',
          value: newMembers,
        },
      ],
    }

    const newMetadataIpfsHash = await pinMetadataToIPFS(
      JWT,
      metadata,
      multisigAddress + ' Image'
    )

    setMembers(newMembers)

    return newMetadataIpfsHash
  }

  useEffect(() => {
    if (!nft?.metadata?.attributes) return
    getMultisigAddress()
    getEntitySocials()
    getEntityMembers()
  }, [nft])

  return { members, multisigAddress, socials, updateEntityMembers }
}
