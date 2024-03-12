import { useContract } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { ENTITY_ADDRESSES } from 'const/config'
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

  const [isLoading, setIsLoading] = useState(false)
  const [entityImage, setEntityImage] = useState<any>()
  const [multisigAddress, setMultisigAddress] = useState<string>()
  const [hatsTreeId, setHatsTreeId] = useState<number>()

  const [pinataJWT, setPinataJWT] = useState<string>()

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

  return (
    <div className="flex flex-col lg:max-w-[1256px] md:items-start">
      <Steps
        className="mb-8 w-full lg:max-w-[900px] md:-ml-12"
        steps={['Info', 'Design', 'Treasury ', 'Organization', 'Mint']}
        currStep={stage}
      />

      {/* Typeform form */}
      {stage === 0 && (
        <StageContainer title="Info" description="Input your information">
          <div className="w-full md:w-3/4">
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
            <StageButton onClick={() => setStage(1)}>Next</StageButton>
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
          description="Design an Image for your Entity."
        >
          {entityImage ? (
            <Image
              src={URL.createObjectURL(entityImage)}
              width={300}
              height={300}
              alt=""
            />
          ) : (
            <div className="w-[300px] h-[300px] bg-[#ffffff50]"></div>
          )}
          <div className="flex flex-col w-[300px]">
            <input
              onChange={(e: any) => setEntityImage(e.target.files[0])}
              type="file"
              accept="image/png, image/jpeg"
            />
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
          </div>
        </StageContainer>
      )}
      {/* Create Gnosis Safe */}
      {stage === 2 && (
        <StageContainer
          title="Treasury"
          description="Create a treasury for your Entity"
        >
          {multisigAddress && (
            <div className="flex flex-col">
              <p>
                <button
                  className="text-moon-gold"
                  onClick={() => {
                    navigator.clipboard.writeText(multisigAddress)
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

              <p>Safe Address: {multisigAddress}</p>
            </div>
          )}
          <Image
            src={'/onboarding-icons/safe.png'}
            width={400}
            height={400}
            alt=""
          />
          <StageButton
            isLoading={isLoading}
            onClick={async () => {
              setIsLoading(true)
              const provider = await wallets[selectedWallet].getEthersProvider()
              const signer = provider?.getSigner()

              //create safe
              try {
                const safeSDK = await createSafe(signer, [address], 1)
                const safeAddress = safeSDK.getAddress()
                setMultisigAddress(safeAddress)

                if (safeAddress) {
                  setStage(3)
                }
              } catch (err) {
                console.error(err)
              }

              setIsLoading(false)
            }}
          >
            Create Safe
          </StageButton>
        </StageContainer>
      )}
      {/* Add Entity members */}
      {stage === 3 && (
        <StageContainer
          title="Organization"
          description="Create a hat tree for your Entity"
        >
          <Image
            src={'/onboarding-icons/hat.png'}
            width={400}
            height={400}
            alt=""
          />
          <StageButton
            isLoading={isLoading}
            onClick={async () => {
              setIsLoading(true)
              //get signer
              const provider = await wallets[selectedWallet].getEthersProvider()
              const signer = provider?.getSigner()
              //sign message
              const nonceRes = await fetch(`/api/db/nonce?address=${address}`)
              const nonceData = await nonceRes.json()
              const message = `Please sign to pin this entity to IPFS #`
              const signature = await signer?.signMessage(
                message + nonceData.nonce
              )

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

              setPinataJWT(JWT)

              const hatMetadata = {
                type: '1.0',
                data: {
                  name: `${entityData.name} Admin`,
                  description: entityData.description,
                },
              }

              const hatMetadataIpfsHash = await pinMetadataToIPFS(
                JWT,
                hatMetadata,
                entityData.name + ' Hat Metadata'
              )

              const tx = await hatsContract.call('mintTopHat', [
                address,
                'ipfs://' + hatMetadataIpfsHash,
                '',
              ])

              const hatsInterface = new ethers.utils.Interface(HatsABI)

              const decoded = hatsInterface.decodeEventLog(
                'HatCreated',
                tx.receipt.logs[0].data
              )

              const treeId = await hatsContract.call('getTopHatDomain', [
                decoded.id.toString(),
              ])

              setHatsTreeId(treeId)

              if (treeId) setStage(4)

              setIsLoading(false)
            }}
          >
            Create Hat Tree
          </StageButton>
        </StageContainer>
      )}
      {/* Pin Image and Metadata to IPFS, Mint NFT to Gnosis Safe */}
      {stage === 4 && (
        <StageContainer title="Mint" description="Mint your Entity NFT!">
          <StageButton
            isLoading={isLoading}
            onClick={async () => {
              setIsLoading(true)
              //pin image to IPFS
              const newImageIpfsHash = await pinImageToIPFS(
                pinataJWT || '',
                entityImage,
                multisigAddress + ' Image'
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
                    trait_type: 'multisig',
                    value: multisigAddress,
                  },
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
                    value: hatsTreeId,
                  },
                ],
              }

              const newMetadataIpfsHash = await pinMetadataToIPFS(
                pinataJWT || '',
                metadata,
                multisigAddress + ' Metadata'
              )

              if (!newMetadataIpfsHash)
                return toast.error('Error pinning metadata to IPFS')
              //mint NFT to safe
              await entityContract?.call(
                'mintTo',
                [address, 'ipfs://' + newMetadataIpfsHash],
                {
                  value: ethers.utils.parseEther('0.01'),
                }
              )
              router.push(`/entities/${nextTokenId}`)
              setIsLoading(false)
            }}
          >
            Mint
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
