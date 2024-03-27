import { useContract } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { ENTITY_ADDRESSES, ENTITY_CREATOR_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import useWindowSize from '../../lib/entity/use-window-size'
import { createSafe } from '../../lib/gnosis/createSafe'
import { pinImageToIPFS, pinMetadataToIPFS } from '@/lib/ipfs/pin'
import { Steps } from '../layout/Steps'
import ArrowButton from '../marketplace/Layout/ArrowButton'
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
  setSelectedTier,
}: any) {
  const router = useRouter()

  const [stage, setStage] = useState<number>(0)
  const [lastStage, setLastStage] = useState<number>(0)

  const [entityImage, setEntityImage] = useState<any>()
  const [multisigAddress, setMultisigAddress] = useState<string>()
  const [hatTreeId, setHatTreeId] = useState<number>()

  const [agreedToCondition, setAgreedToCondition] = useState<boolean>(false)

  const checkboxRef = useRef(null)

  const { isMobile } = useWindowSize()

  const [entityData, setEntityData] = useState<EntityData>({
    name: '',
    description: '',
    twitter: '',
    communications: '',
    website: '',
    view: 'private',
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

  console.log(pfpRef)

  return (
    <div className="flex flex-row">
      <div className="w-[90vw] md:w-full flex flex-col lg:max-w-[1256px] items-start">
        <div className="flex flex-row w-full justify-between md:pr-10">
          <Steps
            className="mb-4 w-[300px] sm:w-[600px] lg:max-w-[900px] md:-ml-16 -ml-10"
            steps={['Info', 'Design', 'Mint']}
            currStep={stage}
            lastStep={lastStage}
            setStep={setStage}
          />
          <button onClick={() => setSelectedTier(null)}>
            <Image src={'/x-white.png'} width={50} height={50} alt="" />
          </button>
        </div>

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
            className={`mb-[500px]`}
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
            >s
              Submit Image
            </StageButton>
          </div> */}
            <ImageGenerator
              setImage={setEntityImage}
              nextStage={() => setStage(2)}
              stage={stage}
            />
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

            <div className="flex flex-col bg-black w-full p-3 md:p-5 mt-10">
              <h2 className="font-GoodTimes text-3xl mb-2">OVERVIEW</h2>
              <div className="flex flex-col bg-[#0F152F] p-3 md:p-5 overflow-auto space-y-3 md:space-y-0">
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
                            <th className="text-xl bg-[#0F152F]">{v}:</th>

                            <th className="text-md bg-[#0F152F] text-pretty">
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
            <div className="flex flex-col bg-black w-full p-3 md:p-5 mt-10">
              <h2 className="font-GoodTimes text-3xl mb-2">IMPORTANT</h2>
              <h2 className="font-GoodTimes text-3xl mb-2">INFORMATION</h2>
              <div className="flex flex-col bg-[#0F152F] p-3 md:p-5">
                <h3 className="font-GoodTimes text-2xl mb-2">TREASURY</h3>
                <p className="mt-2">
                  A self-custodied multisignature treasury will secure your
                  organization’s assets, allowing to interact with any smart
                  contracts within the Ethereum ecosystem. <br /> <br />
                  You can add more signers later via your Entity management
                  portal.
                </p>
              </div>
              <div className="flex flex-col bg-[#0F152F] p-3 md:p-5 mt-5">
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
                className="mt-px font-light text-gray-700  select-none"
                htmlFor="link"
              >
                <p className="text-white">
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
              isDisabled={!agreedToCondition}
              onClick={async () => {
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

        <div className="flex flex-row justify-between w-full mt-8 lg:px-5">
          {stage > 0 ? (
            <button
              className="p-3"
              onClick={() => {
                if (stage > 0) {
                  setStage((prev) => prev - 1)
                }
              }}
            >
              <Image
                alt="arrow left"
                src="./arrow-left.svg"
                height={50}
                width={50}
              />
            </button>
          ) : (
            <p></p>
          )}

          {lastStage > stage && (
            <button
              className="p-3"
              onClick={() => {
                if (stage < 2) {
                  setStage((prev) => prev + 1)
                }
              }}
            >
              <Image
                alt="arrow right"
                src="./arrow-right.svg"
                height={50}
                width={50}
              />
            </button>
          )}
        </div>
      </div>
      {windowSize.width && windowSize.width >= 1835 && (
        <Image
          src={'/entity-bg-image.png'}
          width={400}
          height={windowSize.height}
          alt=""
        />
      )}
    </div>
  )
}
