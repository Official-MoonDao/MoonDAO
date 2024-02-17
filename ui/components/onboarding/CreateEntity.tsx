import { ethers } from 'ethers'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createSafe } from '../../lib/gnosis/createSafe'

export function CreateEntity({ address, wallets, selectedWallet }: any) {
  const userImageRef: any = useRef()
  const [safeAddress, setSafeAddress] = useState<string>()
  return (
    <div className="flex flex-col">
      <input type="file" ref={userImageRef} accept="image/png, image/jpeg" />
      <button
        className="border-2"
        onClick={async () => {
          if (!userImageRef.current?.files?.[0])
            return toast.error('No file selected')

          const fileType = userImageRef.current.files[0].type
          if (fileType !== 'image/png' && fileType !== 'image/jpeg') {
            return toast.error('File type must be .png or .jpeg')
          }

          try {
            //sign and verify message
            const message = 'Please sign to pin this entity to IPFS'
            const provider = await wallets[selectedWallet].getEthersProvider()

            const signer = provider?.getSigner()
            const signature = await signer?.signMessage(message)
            const recoveredAddress = ethers.utils.verifyMessage(
              message,
              signature
            )

            if (recoveredAddress !== address) {
              return toast.error('Unauthorized')
            }

            //pin image to IPFS

            const imageFormData: any = new FormData()

            imageFormData.append('file', userImageRef.current.files[0])
            imageFormData.append('pinataMetadata', { name: 'File Name' })
            imageFormData.append('pinataOptions', { cidVersion: 0 })

            const jwtRes = await fetch('/api/ipfs/upload', {
              method: 'POST',
            })

            const JWT = await jwtRes.text()

            const imageRes = await fetch(
              'https://api.pinata.cloud/pinning/pinFileToIPFS',
              {
                method: 'POST',
                body: imageFormData,
                headers: {
                  Authorization: `Bearer ${JWT}`,
                },
              }
            )

            const { IpfsHash: newImageIpfsHash } = await imageRes.json()

            //pin metadata to IPFS

            const metadata = {
              name: 'test#1',
              description: 'test',
              image: `ipfs://${newImageIpfsHash}`,
            }

            const metadataFormData: any = new FormData()
            metadataFormData.append(
              'pinataMetadata',
              JSON.stringify({ name: 'Test Metadata' })
            )
            metadataFormData.append(
              'pinataOptions',
              JSON.stringify({ cidVersion: 0 })
            )
            metadataFormData.append(
              'file',
              new Blob([JSON.stringify(metadata)], {
                type: 'application/json',
              })
            )

            const metadataRes = await fetch(
              'https://api.pinata.cloud/pinning/pinFileToIPFS',
              {
                method: 'POST',
                body: metadataFormData,
                headers: {
                  Authorization: `Bearer ${JWT}`,
                },
              }
            )

            const { IpfsHash: newMetadataIpfsHash } = await metadataRes.json()

            //create safe
            const safeSDK = await createSafe(signer, [address], 1)
            const safeAddress = await safeSDK.getAddress()
            setSafeAddress(safeAddress)

            //mint NFT to safe

            //claim Entity hat
          } catch (err) {
            console.error(err)
          }
        }}
      >
        Create Entity
      </button>
    </div>
  )
}
