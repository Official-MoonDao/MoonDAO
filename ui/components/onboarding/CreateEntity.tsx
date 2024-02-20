import { Widget } from '@typeform/embed-react'
import { ethers } from 'ethers'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createSafe } from '../../lib/gnosis/createSafe'

export function CreateEntity({ address, wallets, selectedWallet }: any) {
  const userImageRef: any = useRef()

  const [safeAddress, setSafeAddress] = useState<string>()

  return (
    <div className="flex flex-col">
      <Widget
        id="IvM4Kp23"
        onSubmit={async (e) => {
          const responseRes = await fetch(
            `/api/typeform/response?formId=${e.formId}&responseId=${e.responseId}`
          )
          const data = await responseRes.json()
        }}
        height={800}
      />
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
            //get signer
            const provider = await wallets[selectedWallet].getEthersProvider()
            const signer = provider?.getSigner()

            //create safe
            const safeSDK = await createSafe(signer, [address], 1)
            const safeAddress = await safeSDK.getAddress()
            setSafeAddress(safeAddress)

            //sign message
            const message = 'Please sign to pin this entity to IPFS'
            const signature = await signer?.signMessage(message)

            //get pinata jwt
            const jwtRes = await fetch('/api/ipfs/upload', {
              method: 'POST',
              headers: {
                signature,
              },
              body: JSON.stringify({ address, message }),
            })

            const JWT = await jwtRes.text()

            //pin image to IPFS
            const imageFormData = new FormData()

            imageFormData.append('file', userImageRef.current.files[0])
            imageFormData.append(
              'pinataMetadata',
              JSON.stringify({ name: 'File Name' })
            )
            imageFormData.append(
              'pinataOptions',
              JSON.stringify({ cidVersion: 0 })
            )

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

            if (!newImageIpfsHash) {
              return toast.error('Error pinning image to IPFS')
            }

            //get the next token id of the nft collection
            const nextTokenId = 0

            //pin metadata to IPFS
            const metadata = {
              name: `Entity #${nextTokenId}`,
              description: '',
              image: `ipfs://${newImageIpfsHash}`,
              attributes: [
                {
                  trait_type: 'multisig',
                  value: safeAddress,
                },
                {
                  trait_type: 'twitter',
                  value: '',
                },
                {
                  trait_type: 'view',
                  value: '',
                },
              ],
            }

            const metadataFormData: any = new FormData()
            metadataFormData.append(
              'pinataMetadata',
              JSON.stringify({ name: 'Test Metadata.json' })
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
