import { Widget } from '@typeform/embed-react'
import { ethers } from 'ethers'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createSafe } from '../../lib/gnosis/createSafe'
import { CopyIcon } from '../assets'
import { Steps } from '../layout/Steps'

function StageContainer({ children, title }: any) {
  return (
    <div className="animate-fadeIn w-[336px] sm:w-[400px] lg:w-full font-RobotoMono flex flex-col justify-center items-center">
      <h1 className="font-GoodTimes text-3xl mb-8">{title}</h1>
      {children}
    </div>
  )
}

function Button({ onClick, children, isDisabled }: any) {
  return (
    <button
      className={'mt-8 w-[300px] border-2'}
      onClick={onClick}
      disabled={isDisabled}
    >
      {children}
    </button>
  )
}

export function CreateEntity({ address, wallets, selectedWallet }: any) {
  const [stage, setStage] = useState<number>(0)

  const [userImage, setUserImage] = useState<any>()
  const [safeAddress, setSafeAddress] = useState<string>()

  const [entityName, setEntityName] = useState<string>()
  const [entityTwitter, setEntityTwitter] = useState<string>()
  const [entityView, setEntityView] = useState<boolean>(false)

  return (
    <div className="flex flex-col">
      <Steps
        className="mb-8"
        steps={['Info', 'Upload', 'Create Entity', 'Mint']}
        currStep={stage}
      />

      {/* Typeform form */}
      {stage === 0 && (
        <StageContainer title="Info">
          <div className="w-full md:w-3/4">
            <Widget
              id={process.env.NEXT_PUBLIC_TYPEFORM_ENTITY_FORM_ID as string}
              onSubmit={async (formResponse: any) => {
                //get response from form
                const { formId, responseId } = formResponse
                const responseRes = await fetch(
                  `/api/typeform/response?formId=${formId}&responseId=${responseId}`
                )
                const data = await responseRes.json()
                setEntityName(data.answers[2].text)
                setEntityTwitter(data.answers[3].text)
                setEntityView(data.answers[4].boolean)
                setStage(1)
              }}
              height={600}
            />
          </div>
        </StageContainer>
      )}
      {/* Upload & Create Image */}
      {stage === 1 && (
        <StageContainer title="Upload">
          {userImage ? (
            <Image
              src={URL.createObjectURL(userImage)}
              width={300}
              height={300}
              alt=""
            />
          ) : (
            <div className="w-[300px] h-[300px] bg-[#ffffff50]"></div>
          )}
          <div className="flex flex-col w-[300px]">
            <input
              onChange={(e: any) => setUserImage(e.target.files[0])}
              type="file"
              accept="image/png, image/jpeg"
            />
            <Button
              onClick={() => {
                if (!userImage) return toast.error('No file selected')

                const fileType = userImage.type
                if (fileType !== 'image/png' && fileType !== 'image/jpeg') {
                  return toast.error('File type must be .png or .jpeg')
                }
                setStage(2)
              }}
            >
              Submit Image
            </Button>
          </div>
        </StageContainer>
      )}
      {/* Create Gnosis Safe */}
      {stage === 2 && (
        <StageContainer title={'Create Entity'}>
          {safeAddress && (
            <div className="flex flex-col">
              <p>
                <button
                  className="text-moon-gold"
                  onClick={() => {
                    navigator.clipboard.writeText(safeAddress)
                    toast.success('Copied to clipboard')
                  }}
                >
                  Copy
                </button>
                {` your safe address and import it `}
                <Link
                  className="text-moon-gold"
                  href="https://app.safe.global/welcome/accounts"
                  target="_blank"
                  rel="noreferrer"
                >
                  here
                </Link>
              </p>

              <p>Safe Address: {safeAddress}</p>
            </div>
          )}
          <Button
            onClick={async () => {
              const provider = await wallets[selectedWallet].getEthersProvider()
              const signer = provider?.getSigner()

              //create safe
              const safeSDK = await createSafe(signer, [address], 1)
              const safeAddress = safeSDK.getAddress()
              setSafeAddress(safeAddress)

              if (safeAddress) setStage(3)

              try {
              } catch (err) {
                console.error(err)
              }
            }}
          >
            Create Safe
          </Button>
        </StageContainer>
      )}
      {/* Pin Image and Metadata to IPFS, Mint NFT to Gnosis Safe */}
      {stage === 3 && (
        <StageContainer title="Mint">
          <Button
            onClick={async () => {
              //get signer
              const provider = await wallets[selectedWallet].getEthersProvider()
              const signer = provider?.getSigner()
              //sign message
              const message = 'Please sign to pin this entity to IPFS'
              const signature = await signer?.signMessage(message)

              if (!signature) return toast.error('Error signing message')

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

              imageFormData.append('file', userImage)
              imageFormData.append(
                'pinataMetadata',
                JSON.stringify({ name: safeAddress + ' Image' })
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
                description: `MoonDAO Entity : ${entityName}`,
                image: `ipfs://${newImageIpfsHash}`,
                attributes: [
                  {
                    trait_type: 'multisig',
                    value: safeAddress,
                  },
                  {
                    trait_type: 'twitter',
                    value: entityTwitter,
                  },
                  {
                    trait_type: 'view',
                    value: entityView ? 'public' : 'private',
                  },
                ],
              }

              const metadataFormData: any = new FormData()
              metadataFormData.append(
                'pinataMetadata',
                JSON.stringify({ name: safeAddress + ' Metadata.json' })
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
            }}
          >
            Pin to IPFS and Mint Nft
          </Button>
        </StageContainer>
      )}

      {/* Dev Buttons */}
      <div>
        <button onClick={() => setStage((prev) => prev - 1)}>back</button>
        <button onClick={() => setStage((prev) => prev + 1)}>next</button>
      </div>
    </div>
  )
}
