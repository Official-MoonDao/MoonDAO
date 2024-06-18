import { XMarkIcon } from '@heroicons/react/24/outline'
import { useContract } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { ENTITY_ADDRESSES, ENTITY_CREATOR_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import useWindowSize from '../../lib/entity/use-window-size'
import { pinImageToIPFS, pinMetadataToIPFS } from '@/lib/ipfs/pin'
import isTextInavlid from '@/lib/tableland/isTextValid'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import formatEntityFormData, { EntityData } from '@/lib/typeform/entityFormData'
import { Steps } from '../layout/Steps'
import { ImageGenerator } from './ImageGenerator'
import { StageButton } from './StageButton'
import { StageContainer } from './StageContainer'

export function CreateEntity({
  address,
  wallets,
  selectedWallet,
  selectedChain,
  setSelectedTier,
}: any) {
  const router = useRouter()

  const [stage, setStage] = useState<number>(0)
  const [lastStage, setLastStage] = useState<number>(0)

  const [entityImage, setEntityImage] = useState<any>()

  const [agreedToCondition, setAgreedToCondition] = useState<boolean>(false)

  const [isLoadingMint, setIsLoadingMint] = useState<boolean>(false)

  const checkboxRef = useRef(null)

  const { isMobile } = useWindowSize()

  const [entityData, setEntityData] = useState<EntityData>({
    name: '',
    description: '',
    twitter: '',
    communications: '',
    website: '',
    view: 'private',
    formResponseId: '',
  })
  const { windowSize } = useWindowSize()

  useEffect(() => {
    if (stage > lastStage) {
      setLastStage(stage)
    }
  }, [stage, lastStage])

  const { contract: entityContract } = useContract(
    ENTITY_ADDRESSES[selectedChain.slug]
  )

  const { contract: entityCreatorContract } = useContract(
    ENTITY_CREATOR_ADDRESSES[selectedChain.slug]
  )
  const pfpRef = useRef<HTMLDivElement | null>(null)

  const nativeBalance = useNativeBalance()

  return (
    <div className="flex flex-row">
      <div className="w-[90vw] md:w-full flex flex-col lg:max-w-[1256px] items-start">
        <div className="flex flex-row w-full justify-between items-start">
          <Steps
            className="mb-4 w-[300px] sm:w-[600px] lg:max-w-[900px] md:-ml-16 -ml-10"
            steps={['Design', 'Info', 'Mint']}
            currStep={stage}
            lastStep={lastStage}
            setStep={setStage}
          />
          <button onClick={() => setSelectedTier(null)}>
            <XMarkIcon width={50} height={50} />
          </button>
        </div>

        {/* Typeform form */}
        {stage === 0 && (
          <StageContainer
            className={`mb-[350px]`}
            title="Design"
            description="Design your unique onchain registration certificate."
          >
            <ImageGenerator
              setImage={setEntityImage}
              nextStage={() => setStage(1)}
              stage={stage}
            />
          </StageContainer>
        )}
        {/* Upload & Create Image */}
        {stage === 1 && (
          <StageContainer
            title="Info"
            description="Input your organization's information."
          >
            <div className="w-full">
              <Widget
                className="w-[100%] md:w-[100%]"
                id={process.env.NEXT_PUBLIC_TYPEFORM_ENTITY_FORM_ID as string}
                onSubmit={async (formResponse: any) => {
                  const provider = await wallets[
                    selectedWallet
                  ].getEthersProvider()
                  const signer = provider?.getSigner()

                  const nonceRes = await fetch(
                    `/api/db/nonce?address=${address}`
                  )
                  const nonceData = await nonceRes.json()

                  const message = `Please sign this message to subit the form #`

                  const signature = await signer.signMessage(
                    message + nonceData.nonce
                  )

                  if (!signature) return toast.error('Error signing message')

                  //get response from form
                  const { formId, responseId } = formResponse
                  const responseRes = await fetch(
                    `/api/typeform/response?formId=${formId}&responseId=${responseId}`,
                    {
                      method: 'POST',
                      headers: {
                        signature,
                      },
                      body: JSON.stringify({
                        address,
                        message,
                      }),
                    }
                  )
                  const data = await responseRes.json()

                  const entityFormData = formatEntityFormData(
                    data.answers,
                    responseId
                  )

                  //check for invalid text
                  const invalidText = Object.values(entityFormData).some(
                    (v: any) => isTextInavlid(v)
                  )

                  if (invalidText) {
                    return
                  }

                  setEntityData(entityFormData)
                  setStage(2)
                }}
                height={700}
              />
            </div>
          </StageContainer>
        )}
        {/* Pin Image and Metadata to IPFS, Mint NFT to Gnosis Safe */}
        {stage === 2 && (
          <StageContainer
            title="Mint Entity"
            description="Please review your onchain Entity before minting."
          >
            {/* <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
              {`Make sure all your information is displayed correcly.`}
            </p>
            <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
              {`Welcome to the future of off-world coordination with MoonDAO.`}
            </p> */}

            <Image
              src={URL.createObjectURL(entityImage)}
              alt="entity-image"
              width={600}
              height={600}
            />

            <div className="flex flex-col dark:bg-black w-full p-3 md:p-5 mt-10 max-w-[600px]">
              <h2 className="font-GoodTimes text-3xl mb-2">OVERVIEW</h2>
              <div className="flex flex-col border-2 dark:border-0 dark:bg-[#0F152F] p-3 md:p-5 overflow-auto space-y-3 md:space-y-0">
                {isMobile ? (
                  Object.keys(entityData).map((v, i) => {
                    return (
                      <div
                        className="flex flex-col text-left"
                        key={'entityData' + i}
                      >
                        <p className="text-xl capitalize">{v}:</p>

                        <p className="text-md text-balance">
                          {/**@ts-expect-error */}
                          {entityData[v]!}
                        </p>
                      </div>
                    )
                  })
                ) : (
                  <table className="table w-fit">
                    <tbody>
                      {Object.keys(entityData).map((v, i) => {
                        return (
                          <tr className="" key={'entityData' + i}>
                            <th className="text-xl border-2 dark:border-0 dark:bg-[#0F152F]">
                              {v}:
                            </th>

                            <th className="text-md border-2 dark:border-0 dark:bg-[#0F152F] text-pretty">
                              {/**@ts-expect-error */}
                              {entityData[v]!}
                            </th>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="flex flex-col border-2 dark:border-0 dark:bg-black w-full p-3 md:p-5 mt-10 max-w-[600px]">
              <h2 className="font-GoodTimes text-3xl mb-2">IMPORTANT</h2>
              <h2 className="font-GoodTimes text-3xl mb-2">INFORMATION</h2>
              <div className="flex flex-col border-2 dark:bg-[#0F152F] dark:border-0 p-3 md:p-5">
                <h3 className="font-GoodTimes text-2xl mb-2">TREASURY</h3>
                <p className="mt-2">
                  A self-custodied multisignature treasury will secure your
                  organization’s assets, allowing to interact with any smart
                  contracts within the Ethereum ecosystem. <br /> <br />
                  You can add more signers later via your Entity management
                  portal.
                </p>
              </div>
              <div className="flex flex-col border-2 dark:border-0 dark:bg-[#0F152F] p-3 md:p-5 mt-5">
                <h3 className="font-GoodTimes text-2xl mb-2">ADMINISTRATOR</h3>
                <p className="mt-2">
                  The admin can modify your organization’s information. To
                  begin, the currently connected wallet will act as the
                  Administrator.
                  <br /> <br />
                  You can change the admin or add more members to your
                  organization using the Hats Protocol within your Entity
                  Management Portal.
                </p>
              </div>
              <p className="mt-4">
                Welcome to the future of off-world coordination with MoonDAO!
              </p>
            </div>
            <div className="flex flex-row items-center mt-4">
              <label
                className="relative flex items-center p-3 rounded-full cursor-pointer"
                htmlFor="link"
              >
                <input
                  checked={agreedToCondition}
                  onChange={(e) => setAgreedToCondition(e.target.checked)}
                  type="checkbox"
                  className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-md border border-[#D7594F] transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-blue-gray-500 before:opacity-0 before:transition-opacity checked:border-[#D7594F] checked:bg-gray-900 checked:before:bg-gray-900 hover:before:opacity-10"
                  id="link"
                />
                <span className="absolute text-white transition-opacity opacity-0 pointer-events-none top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 peer-checked:opacity-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </span>
              </label>
              <label
                className="mt-px font-light text-gray-700  select-none max-w-[550px]"
                htmlFor="link"
              >
                <p className="text-black dark:text-white">
                  I have read and accepted the terms and conditions.
                  <a
                    rel="noopener noreferrer"
                    className="text-sky-400"
                    href="https://www.apple.com/pro-display-xdr/"
                    target="_blank"
                  >
                    {' '}
                    Learn more{' '}
                  </a>{' '}
                  about MoonDAO's terms and conditions
                </p>
              </label>
            </div>
            <StageButton
              isDisabled={!agreedToCondition || isLoadingMint}
              onClick={async () => {
                if (nativeBalance < 0.01) {
                  return toast.error('Insufficient balance')
                }

                //sign message
                const provider = await wallets[
                  selectedWallet
                ].getEthersProvider()
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

                const adminHatMetadataIpfsHash = await pinMetadataToIPFS(
                  pinataJWT || '',
                  {
                    type: '1.0',
                    data: {
                      name: entityData.name + ' Admin',
                      description: entityData.description,
                    },
                  },
                  entityData.name + 'Admin Hat Metadata'
                )

                const managerHatMetadataIpfsHash = await pinMetadataToIPFS(
                  pinataJWT || '',
                  {
                    type: '1.0',
                    data: {
                      name: entityData.name + ' Manager',
                      description: entityData.description,
                    },
                  },
                  entityData.name + 'Manager Hat Metadata'
                )

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

                  setIsLoadingMint(true)
                  //mint NFT to safe
                  const mintTx = await entityCreatorContract?.call(
                    'createMoonDAOEntity',
                    [
                      'ipfs://' + adminHatMetadataIpfsHash,
                      'ipfs://' + managerHatMetadataIpfsHash,
                      entityData.name,
                      entityData.description,
                      `ipfs://${newImageIpfsHash}`,
                      entityData.twitter,
                      entityData.communications,
                      entityData.website,
                      entityData.view,
                      entityData.formResponseId,
                    ],
                    {
                      value: ethers.utils.parseEther('0.01'),
                    }
                  )

                  const mintedTokenId = parseInt(
                    mintTx.receipt.logs[7].topics[3],
                    16
                  ).toString()

                  setTimeout(() => {
                    setIsLoadingMint(false)
                    router.push(`/entity/${mintedTokenId}`)
                  }, 30000)
                } catch (err) {
                  console.error(err)
                  setIsLoadingMint(false)
                }
              }}
            >
              {isLoadingMint ? 'loading...' : 'Mint'}
            </StageButton>
          </StageContainer>
        )}
      </div>
    </div>
  )
}
