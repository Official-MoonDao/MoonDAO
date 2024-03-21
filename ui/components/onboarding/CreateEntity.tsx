import { useContract } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { ENTITY_ADDRESSES, ENTITY_CREATOR_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { createSafe } from '../../lib/gnosis/createSafe'
import { pinImageToIPFS, pinMetadataToIPFS } from '@/lib/ipfs/pin'
import HatsABI from '../../const/abis/Hats.json'
import { Steps } from '../layout/Steps'
import { ImageGenerator } from './ImageGenerator'
import { StageButton } from './StageButton'
import { StageContainer } from './StageContainer'

type EntityData = {
  name: string
  description: string
  twitter: string
  communications: string
  website: string
  view: string
}

export function CreateEntity({
  address,
  wallets,
  selectedWallet,
  selectedChain,
  hatsContract,
}: any) {
  const router = useRouter()

  const [stage, setStage] = useState<number>(0)

  const [entityImage, setEntityImage] = useState<any>()
  const [multisigAddress, setMultisigAddress] = useState<string>()
  const [hatTreeId, setHatTreeId] = useState<number>()

  const [entityData, setEntityData] = useState<EntityData>({
    name: '',
    description: '',
    twitter: '',
    communications: '',
    website: '',
    view: 'private',
  })

  const { contract: entityContract } = useContract(
    ENTITY_ADDRESSES[selectedChain.slug]
  )

  const { contract: entityCreatorContract } = useContract(
    ENTITY_CREATOR_ADDRESSES[selectedChain.slug]
  )

  return (
    <div className="w-[90vw] md:w-full flex flex-col lg:max-w-[1256px] items-start">
      <Steps
        className="mb-4 w-full lg:max-w-[900px] md:-ml-12"
        steps={['Info', 'Design', 'Mint']}
        currStep={stage}
      />

      {/* Typeform form */}
      {stage === 0 && (
        <StageContainer
          title="Info"
          description="Input your organization's information."
        >
          <div className="w-full">
            <Widget
              className="w-[100%] md:w-[100%]"
              id={process.env.NEXT_PUBLIC_TYPEFORM_ENTITY_FORM_ID as string}
              onSubmit={async (formResponse: any) => {
                //get response from form
                const { formId, responseId } = formResponse
                const responseRes = await fetch(
                  `/api/typeform/response?formId=${formId}&responseId=${responseId}`
                )
                const data = await responseRes.json()

                console.log(data)

                setEntityData({
                  name: data.answers[0].text,
                  description: data.answers[1].text,
                  website: data.answers[2].url,
                  twitter: data.answers[3].url,
                  communications: data.answers[4].url,
                  view:
                    data.answers[5].choice.label === 'Yes'
                      ? 'public'
                      : 'private',
                })
                setStage(1)
              }}
              height={500}
            />
            <button
              className="p-2 border-2"
              onClick={() => {
                setEntityData({
                  name: 'Test Entity',
                  description: 'Test Org description for testing',
                  twitter: 'https://twitter.com/OfficialMoonDAO',
                  communications: 'https://discord.com',
                  website: 'https://google.com',
                  view: 'public',
                })
                setStage(1)
              }}
            >{`Complete form (testing)`}</button>
          </div>
        </StageContainer>
      )}
      {/* Upload & Create Image */}
      {stage === 1 && (
        <StageContainer
          title="Design"
          description="Design your unique onchain registration certificate."
        >
          {/* {entityImage ? (
            <Image
              src={URL.createObjectURL(entityImage)}
              width={300}
              height={300}
              alt=""
            />
          ) : (
            <div className="w-[350px] h-[350px] bg-[#ffffff50]"></div>
          )}
          <div className="flex flex-col w-[400px]">
            <input
              onChange={(e: any) => setEntityImage(e.target.files[0])}
              type="file"
              accept="image/png, image/jpeg"
            />
            <p className="mt-6 font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
              {`Upload your organization's logo to create a unique image that represents your Entity's certification onchain.`}
            </p>
            <StageButton
              onClick={() => {
                if (!entityImage) return toast.error('No file selected')

                const fileType = entityImage.type
                if (fileType !== 'image/png' && fileType !== 'image/jpeg') {
                  return toast.error('File type must be .png or .jpeg')
                }
                setStage(2)
              }}
            >
              Submit Image
            </StageButton>
          </div> */}
          <ImageGenerator
            setImage={setEntityImage}
            nextStage={() => setStage(2)}
          />
        </StageContainer>
      )}
      {/* Pin Image and Metadata to IPFS, Mint NFT to Gnosis Safe */}
      {stage === 2 && (
        <StageContainer
          title="Mint Entity"
          description="Mint your Entity onchain!"
        >
          <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
            {`Make sure all your information is displayed correcly.`}
          </p>
          <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
            {`Welcome to the future of off-world coordination with MoonDAO.`}
          </p>
          <StageButton
            onClick={async () => {
              //sign message
              const provider = await wallets[selectedWallet].getEthersProvider()
              const signer = provider?.getSigner()

              const nonceRes = await fetch(`/api/db/nonce?address=${address}`)
              const nonceData = await nonceRes.json()

              const message = `Please sign this message to mint this entity's NFT #`

              const signature = await signer.signMessage(
                message + nonceData.nonce
              )

              if (!signature) return toast.error('Error signing message')

              //get pinata jwt
              const jwtRes = await fetch('/api/ipfs/upload', {
                method: 'POST',
                headers: {
                  signature,
                },
                body: JSON.stringify({
                  address: wallets[selectedWallet].address,
                  message,
                }),
              })

              const pinataJWT = await jwtRes.text()

              try {
                //pin image to IPFS
                const newImageIpfsHash = await pinImageToIPFS(
                  pinataJWT || '',
                  entityImage,
                  entityData.name + ' Image'
                )

                if (!newImageIpfsHash) {
                  return toast.error('Error pinning image to IPFS')
                }

                //get the next token id of the nft collection
                const totalSupply = await entityContract?.call('totalSupply')
                const nextTokenId = totalSupply.toString()

                // pin metadata to IPFS
                const metadata = {
                  name: `Entity #${nextTokenId}`,
                  description: `${entityData.name} : ${entityData.description}`,
                  image: `ipfs://${newImageIpfsHash}`,
                  attributes: [
                    {
                      trait_type: 'twitter',
                      value: entityData.twitter,
                    },
                    {
                      trait_type: 'communications',
                      value: entityData.communications,
                    },
                    {
                      trait_type: 'website',
                      value: entityData.website,
                    },
                    {
                      trait_type: 'view',
                      value: entityData.view,
                    },
                    {
                      trait_type: 'hatsTreeId',
                      value: hatTreeId,
                    },
                  ],
                }

                const newMetadataIpfsHash = await pinMetadataToIPFS(
                  pinataJWT || '',
                  metadata,
                  entityData.name + ' Metadata'
                )

                if (!newMetadataIpfsHash)
                  return toast.error('Error pinning metadata to IPFS')
                //mint NFT to safe
                await entityCreatorContract?.call(
                  'createMoonDAOEntity',
                  ['ipfs://' + newMetadataIpfsHash],
                  {
                    value: ethers.utils.parseEther('0.01'),
                  }
                )

                router.push(`/entity/${nextTokenId}`)
              } catch (err) {
                console.error(err)
              }
            }}
          >
            Mint Entity
          </StageButton>
        </StageContainer>
      )}

      {/* Dev Buttons */}

      <div className="ml-8 flex flex-row justify-between w-3/4 mt-8">
        <button
          className="p-3 bg-blue-500"
          onClick={() => {
            if (stage > 0) {
              setStage((prev) => prev - 1)
            }
          }}
        >
          Back
        </button>
        <button
          className="p-3 bg-red-500"
          onClick={() => {
            if (stage < 4) {
              setStage((prev) => prev + 1)
            }
          }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
