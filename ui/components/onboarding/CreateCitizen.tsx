import { XMarkIcon } from '@heroicons/react/24/outline'
import { useContract } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import {
  CITIZEN_ADDRESSES,
  ENTITY_ADDRESSES,
  ENTITY_CREATOR_ADDRESSES,
} from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import useWindowSize from '../../lib/entity/use-window-size'
import { createSafe } from '../../lib/gnosis/createSafe'
import { useNewsletterSub } from '@/lib/convert-kit/useNewsletterSub'
import { pinImageToIPFS, pinMetadataToIPFS } from '@/lib/ipfs/pin'
import { Steps } from '../layout/Steps'
import ArrowButton from '../marketplace/Layout/ArrowButton'
import { ImageGenerator } from './ImageGenerator'
import { StageButton } from './StageButton'
import { StageContainer } from './StageContainer'

type CitizenData = {
  firstName: string
  lastName: string
  email: string
  description: string
  location: string
  view: string
}

export function CreateCitizen({
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

  const checkboxRef = useRef(null)

  const { isMobile } = useWindowSize()

  const [citizenData, setCitizenData] = useState<CitizenData>({
    firstName: '',
    lastName: '',
    email: '',
    description: '',
    location: '',
    view: '',
  })
  const { windowSize } = useWindowSize()

  useEffect(() => {
    if (stage > lastStage) {
      setLastStage(stage)
    }
  }, [stage, lastStage])

  const { contract: citizenContract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  )

  const pfpRef = useRef<HTMLDivElement | null>(null)

  const subscribeToNewsletter = useNewsletterSub()

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
            <XMarkIcon width={50} height={50} />
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
                id={process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string}
                onSubmit={async (formResponse: any) => {
                  //get response from form
                  const { formId, responseId } = formResponse
                  const responseRes = await fetch(
                    `/api/typeform/response?formId=${formId}&responseId=${responseId}`
                  )
                  const data = await responseRes.json()

                  //subscribe to newsletter
                  if (data.answers[6].boolean) {
                    const subRes = await subscribeToNewsletter(
                      data.answers[2].email
                    )
                    console.log(subRes)
                    if (subRes.ok) {
                      toast.success(
                        'Successfully subscribed to the newsletter! Open your email and confirm your subscription.'
                      )
                    }
                  }

                  setCitizenData({
                    firstName: data.answers[0].text,
                    lastName: data.answers[1].text,
                    email: data.answers[2].email,
                    description: data.answers[3].text,
                    location: data.answers[4].text,
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
                  setCitizenData({
                    firstName: 'First',
                    lastName: 'Last',
                    email: 'colin@moondao.com',
                    description: 'Test citizen description',
                    location: 'Earth',
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
            className={`mb-[500px] 2xl:mb-0`}
            title="Design"
            description="Design your unique onchain registration certificate."
          >
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

            <div className="flex flex-col border-2 dark:border-0 dark:bg-black w-full p-3 md:p-5 mt-10">
              <h2 className="font-GoodTimes text-3xl mb-2">OVERVIEW</h2>
              <div className="flex flex-col border-2 dark:border-0 dark:bg-[#0F152F] p-3 md:p-5 overflow-auto space-y-3 md:space-y-0">
                {isMobile ? (
                  Object.keys(citizenData).map((v, i) => {
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
                      {Object.keys(citizenData).map((v, i) => {
                        return (
                          <tr className="" key={'entityData' + i}>
                            <th className="text-xl dark:bg-[#0F152F]">{v}:</th>

                            <th className="text-md dark:bg-[#0F152F] text-pretty">
                              {/**@ts-expect-error */}
                              {citizenData[v]!}
                            </th>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="flex flex-col border-2 dark:border-0  dark:bg-black w-full p-3 md:p-5 mt-10">
              <h2 className="font-GoodTimes text-3xl mb-2">IMPORTANT</h2>
              <h2 className="font-GoodTimes text-3xl mb-2">INFORMATION</h2>
              <div className="flex flex-col border-2 dark:border-0 dark:bg-[#0F152F] p-3 md:p-5 mt-5">
                <h3 className="font-GoodTimes text-2xl mb-2">MEMBERSHIP</h3>
                <p className="mt-2">
                  Memerships will last for one year, and can be renewed at any
                  time. All funds are self-custodied, so even if your memership
                  expires you still own those funds.
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
                <p className="dark:text-white">
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
                    citizenData.firstName + citizenData.lastName + ' Image'
                  )

                  if (!newImageIpfsHash) {
                    return toast.error('Error pinning image to IPFS')
                  }

                  //get the next token id of the nft collection
                  const totalSupply = await citizenContract?.call('totalSupply')
                  const nextTokenId = totalSupply.toString()

                  // pin metadata to IPFS
                  const metadata = {
                    name: `${citizenData.firstName} ${citizenData.lastName}`,
                    description: citizenData.description,
                    image: `ipfs://${newImageIpfsHash}`,
                    attributes: [
                      {
                        trait_type: 'location',
                        value: citizenData.location,
                      },
                      {
                        trait_type: 'view',
                        value: citizenData.view,
                      },
                    ],
                  }

                  const newMetadataIpfsHash = await pinMetadataToIPFS(
                    pinataJWT || '',
                    metadata,
                    citizenData.firstName + citizenData.lastName + ' Metadata'
                  )

                  if (!newMetadataIpfsHash)
                    return toast.error('Error pinning metadata to IPFS')
                  //mint NFT to safe
                  await citizenContract?.call(
                    'mintTo',
                    [address, 'ipfs://' + newMetadataIpfsHash],
                    {
                      value: ethers.utils.parseEther('0.01'),
                    }
                  )

                  router.push(`/citizen/${nextTokenId}`)
                } catch (err) {
                  console.error(err)
                }
              }}
            >
              Mint Citizen
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
