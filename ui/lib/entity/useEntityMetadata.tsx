import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { NFT } from '@thirdweb-dev/sdk'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { pinMetadataToIPFS } from '../ipfs/pin'
import PrivyWalletContext from '../privy/privy-wallet-context'

export function useEntityMetadata(entityContract: any, nft: NFT) {
  const address = useAddress()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [members, setMembers] = useState<string[]>()
  const [multisigAddress, setMultisigAddress] = useState<any>()

  function getMultisigAddress() {
    if (!nft.metadata.attributes) return
    const entityMultisigAddress = Object.entries(nft.metadata.attributes).find(
      (attr: any) => {
        if (attr.trait_type === 'Multisig') {
          return attr.value
        }
      }
    )

    setMultisigAddress(entityMultisigAddress)
  }

  function getEntityMembers() {
    if (!nft.metadata.attributes) return
    const entityMembers = Object.entries(nft.metadata.attributes).map(
      (attr: any) => {
        if (attr.trait_type === 'Member') {
          return attr.value
        }
      }
    )
  }

  async function updateEntityMembers(newMembers: string[]) {
    if (address != multisigAddress)
      return toast.error('Connect the entity multisig to update members')

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
    getMultisigAddress()
    getEntityMembers()
  }, [nft])

  return { members, multisigAddress, updateEntityMembers }
}
