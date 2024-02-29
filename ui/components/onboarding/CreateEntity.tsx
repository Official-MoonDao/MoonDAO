import { PlusCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useContract } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { ENTITY_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createSafe } from '../../lib/gnosis/createSafe'
import { pinImageToIPFS, pinMetadataToIPFS } from '@/lib/ipfs/pin'
import { Steps } from '../layout/Steps'
import { StageButton } from './StageButton'
import { StageContainer } from './StageContainer'

type EntityData = {
  name: string
  description: string
  twitter: string
  discord: string
  telegram: string
  website: string
  view: boolean
}

export function CreateEntity({
  address,
  wallets,
  selectedWallet,
  selectedChain,
}: any) {
  const [stage, setStage] = useState<number>(0)

  const [entityImage, setEntityImage] = useState<any>()
  const [multisigAddress, setMultisigAddress] = useState<string>()

  const [entityData, setEntityData] = useState<EntityData>({
    name: '',
    description: '',
    twitter: '',
    discord: '',
    telegram: '',
    website: '',
    view: false,
  })

  const [entityMembers, setEntityMembers] = useState<string[]>([])
  const currMemberRef = useRef<any>()

  const { contract: entityContract } = useContract(
    ENTITY_ADDRESSES[selectedChain.slug]
  )

  return (
    <div className="flex flex-col">
      <Steps
        className="mb-8"
        steps={['Info', 'Design', 'Create Entity', 'Add Members', 'Mint']}
        currStep={stage}
      />

      {/* Typeform form */}
      {stage === 0 && (
        <StageContainer title="Info" description="Complete the form.">
          <div className="w-full md:w-3/4">
            <Widget
              className="w-[100vw] md:w-[100%]"
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
                  twitter: '',
                  discord: '',
                  telegram: '',
                  website: '',
                  view: data.answers[3].boolean,
                })
                setStage(1)
              }}
              height={500}
            />
            {/* <button
              className="p-2 border-2"
              onClick={() => {
                setEntityData({
                  name: 'Test Org',
                  description: 'Test Org description for testing',
                  twitter: 'https://twitter.com/OfficialMoonDAO',
                  discord:'',
                  telegram: '',
                  website: 'https://google.com',
                  view: true,
                })
                setStage(1)
              }}
            >{`Complete form (testing)`}</button> */}
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
          title="Create Entity"
          description="Create a gnosis safe for your Entity."
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
          <StageButton
            onClick={async () => {
              const provider = await wallets[selectedWallet].getEthersProvider()
              const signer = provider?.getSigner()

              //create safe
              try {
                const safeSDK = await createSafe(signer, [address], 1)
                const safeAddress = safeSDK.getAddress()
                setMultisigAddress(safeAddress)

                if (safeAddress) {
                  setEntityMembers([address])
                  setStage(3)
                }
              } catch (err) {
                console.error(err)
              }
            }}
          >
            Create Safe
          </StageButton>
        </StageContainer>
      )}
      {/* Add Entity members */}
      {stage === 3 && (
        <StageContainer
          title="Add Members"
          description="Add members to your entity."
        >
          <div className="flex flex-col gap-4">
            <div className="w-full flex gap-4">
              <input
                className="px-2 text-black w-5/6 bg-[#00000025] dark:bg-[#ffffff25]"
                type="text"
                ref={currMemberRef}
              />
              <button
                className="flex items-center text-moon-orange"
                onClick={() => {
                  const currMember = currMemberRef.current.value
                  if (currMember.length != 42 || !currMember.startsWith('0x'))
                    return toast.error('Invalid address')
                  if (entityMembers.includes(currMember))
                    return toast.error('Member already added')
                  setEntityMembers((prev) => [...prev, currMember])
                }}
              >
                <PlusCircleIcon className="h-12 w-12" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {entityMembers.map((member) => (
                <>
                  <div
                    key={member}
                    className="flex items-center justify-between text-[80%]"
                  >
                    <p>{member}</p>
                    <button
                      className="hover:scale-110 duration-300"
                      onClick={() => {
                        if (entityMembers.length === 1)
                          return toast.error(
                            'Entities must have at least one member'
                          )
                        setEntityMembers((prev) =>
                          prev.filter((m) => m != member)
                        )
                      }}
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  <hr className="border-1"></hr>
                </>
              ))}
            </div>
          </div>
          <StageButton
            onClick={() => {
              if (entityMembers.length === 0)
                return toast.error('Entities must have at least one member')
              setStage(4)
            }}
          >
            Submit Members
          </StageButton>
        </StageContainer>
      )}
      {/* Pin Image and Metadata to IPFS, Mint NFT to Gnosis Safe */}
      {stage === 4 && (
        <StageContainer title="Mint" description="Mint your Entity NFT!">
          <StageButton
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

              console.log(JWT)

              //pin image to IPFS
              const newImageIpfsHash = await pinImageToIPFS(
                JWT,
                entityImage,
                multisigAddress + ' Image'
              )

              if (!newImageIpfsHash) {
                return toast.error('Error pinning image to IPFS')
              }

              //get the next token id of the nft collection
              const totalSupply = await entityContract?.call('totalSupply')
              const nextTokenId = totalSupply.toString()
              //pin metadata to IPFS
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
                    trait_type: 'discord',
                    value: entityData.discord,
                  },
                  {
                    trait_type: 'telegram',
                    value: entityData.telegram,
                  },
                  {
                    trait_type: 'website',
                    value: entityData.website,
                  },
                  {
                    trait_type: 'view',
                    value: entityData.view ? 'public' : 'private',
                  },
                  {
                    trait_type: 'members',
                    value: entityMembers.join(','),
                  },
                ],
              }

              const newMetadataIpfsHash = await pinMetadataToIPFS(
                JWT,
                metadata,
                multisigAddress + ' Metadata'
              )

              if (!newMetadataIpfsHash)
                return toast.error('Error pinning metadata to IPFS')
              //mint NFT to safe
              entityContract?.call(
                'mintTo',
                [multisigAddress, 'ipfs://' + newMetadataIpfsHash],
                {
                  value: ethers.utils.parseEther('0.01'),
                }
              )
            }}
          >
            Mint
          </StageButton>
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
