import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { pinMetadataToIPFS } from '../ipfs/pin'
import { useHandleRead } from '../thirdweb/hooks'

function getAttribute(attributes: any[], traitType: string) {
  return Object.values(attributes).find(
    (attr: any) => attr.trait_type === traitType
  )
}

export function useEntityData(entityContract: any, nft: any) {
  const address = useAddress()
  const { wallets } = useWallets()

  const [multisigAddress, setMultisigAddress] = useState<any>()
  const [socials, setSocials] = useState<any>()
  const [isPublic, setIsPublic] = useState<boolean>(false)
  const [hatTreeId, setHatTreeId] = useState<number>()

  const { data: admin } = useHandleRead(entityContract, 'getAdmin', [
    nft?.metadata?.id,
  ])

  function getMultisigAddress() {
    const entityMultisigAddress = getAttribute(
      nft.metadata.attributes,
      'multisig'
    )
    setMultisigAddress(entityMultisigAddress.value)
  }

  function getView() {
    const entityView: any = getAttribute(nft.metadata.attributes, 'view')
    setIsPublic(entityView?.value === 'public' ? true : false)
  }

  function getEntitySocials() {
    const entityTwitter = getAttribute(nft.metadata.attributes, 'twitter')
    const entityCommunications = getAttribute(
      nft.metadata.attributes,
      'communications'
    )
    const entityWebsite = getAttribute(nft.metadata.attributes, 'website')
    setSocials({
      twitter: entityTwitter?.value,
      communications: entityCommunications?.value,
      website: entityWebsite?.value,
    })
  }

  function getHatTreeId() {
    const entityHatTreeId = getAttribute(nft.metadata.attributes, 'hatsTreeId')
    setHatTreeId(entityHatTreeId.value)
  }

  async function updateMetadata(newMetadata: any) {
    if (address != multisigAddress && address != admin)
      return toast.error(
        `Connect the entity's admin wallet or multisig to update metadata`
      )

    const EOAWallet = wallets.find((w: any) => w.walletClientType != 'safe')

    if (!EOAWallet) return toast.error('No EOAWallet found')

    const provider = await EOAWallet.getEthersProvider()
    const signer = provider?.getSigner()

    const nonceRes = await fetch(`/api/db/nonce?address=${address}`)

    const nonceData = await nonceRes.json()

    const message = `Please sign this message to update this entity's metadata #`

    const signature = await signer.signMessage(message + nonceData.nonce)

    if (!signature) return toast.error('Error signing message')

    const jwtRes = await fetch('/api/ipfs/upload', {
      method: 'POST',
      headers: {
        signature,
      },
      body: JSON.stringify({ address: EOAWallet.address, message }),
    })

    const JWT = await jwtRes.text()

    const newMetadataIpfsHash = await pinMetadataToIPFS(
      JWT,
      newMetadata,
      multisigAddress + ' Metadata'
    )

    if (!newMetadataIpfsHash)
      return toast.error('Error pinning metadata to IPFS')

    await entityContract.call('setTokenURI', [
      nft.metadata.id,
      'ipfs://' + newMetadataIpfsHash,
    ])
  }

  useEffect(() => {
    if (!nft?.metadata?.attributes) return
    getMultisigAddress()
    getEntitySocials()
    getView()
    getHatTreeId()
  }, [nft])

  return {
    multisigAddress,
    socials,
    isPublic,
    hatTreeId,
    admin,
    updateMetadata,
  }
}
