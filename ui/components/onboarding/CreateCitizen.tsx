import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import { useContract } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { CITIZEN_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import useWindowSize from '../../lib/team/use-window-size'
import { useNewsletterSub } from '@/lib/convert-kit/useNewsletterSub'
import { pinImageToIPFS } from '@/lib/ipfs/pin'
import isTextInavlid from '@/lib/tableland/isTextValid'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import formatCitizenFormData, {
  CitizenData,
} from '@/lib/typeform/citizenFormData'
import { Steps } from '../layout/Steps'
import { ImageGenerator } from './ImageGenerator'
import { StageButton } from './StageButton'
import { StageContainer } from './StageContainer'

export default function CreateCitizen({
  address,
  wallets,
  selectedWallet,
  selectedChain,
  setSelectedTier,
}: any) {
  const router = useRouter()

  const { getAccessToken } = usePrivy()

  const [stage, setStage] = useState<number>(0)
  const [lastStage, setLastStage] = useState<number>(0)

  const [citizenImage, setCitizenImage] = useState<any>()
  const [citizenData, setCitizenData] = useState<CitizenData>({
    firstName: '',
    lastName: '',
    email: '',
    description: '',
    location: '',
    view: '',
    discord: '',
    website: '',
    twitter: '',
    formResponseId: '',
    newsletterSub: false,
  })
  const [agreedToCondition, setAgreedToCondition] = useState<boolean>(false)

  const [isLoadingMint, setIsLoadingMint] = useState<boolean>(false)

  const checkboxRef = useRef(null)

  const { isMobile } = useWindowSize()

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

  const nativeBalance = useNativeBalance()

  return (
    <div className="flex flex-row">
      <div className="w-[90vw] md:w-full flex flex-col lg:max-w-[1256px] items-start">
        <div className="flex flex-row w-full justify-between items-start">
          <Steps
            className="mb-4 w-[300px] sm:w-[600px] lg:w-[800px] md:-ml-16 -ml-10"
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
            description="Design your unique passport image and on-chain registration profile."
          >
            <ImageGenerator
              setImage={setCitizenImage}
              nextStage={() => setStage(1)}
              stage={stage}
            />
          </StageContainer>
        )}
        {/* Upload & Create Image */}
        {stage === 1 && (
          <StageContainer description="Please complete your citizen profile.">
            <div className="w-full">
              <Widget
                className="w-[100%] md:w-[100%]"
                id={process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string}
                onSubmit={async (formResponse: any) => {
                  //get response from form
                  const accessToken = await getAccessToken()

                  const { formId, responseId } = formResponse
                  const responseRes = await fetch(
                    `/api/typeform/response?formId=${formId}&responseId=${responseId}`,
                    {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${accessToken}`,
                      },
                    }
                  )
                  const data = await responseRes.json()

                  const citizenFormData = formatCitizenFormData(
                    data.answers,
                    responseId
                  )

                  //subscribe to newsletter
                  if (citizenFormData.newsletterSub) {
                    const subRes = await subscribeToNewsletter(
                      citizenFormData.email
                    )
                    if (subRes.ok) {
                      toast.success(
                        'Successfully subscribed to the newsletter! Open your email and confirm your subscription.'
                      )
                    }
                  }

                  setCitizenData(citizenFormData)

                  //check for emojis
                  const invalidText = Object.values(citizenFormData).some(
                    (v: any) => isTextInavlid(v)
                  )

                  if (invalidText) {
                    return
                  }

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
            description="Please review your onchain profile before minting."
          >
            {/* <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
              {`Make sure all your information is displayed correcly.`}
            </p>
            <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
              {`Welcome to the future of off-world coordination with MoonDAO.`}
            </p> */}

            <Image
              src={URL.createObjectURL(citizenImage)}
              alt="entity-image"
              width={600}
              height={600}
            />

            <div className="flex flex-col border-2 dark:border-0 dark:bg-black w-full p-3 md:p-5 mt-10 max-w-[600px]">
              <h2 className="font-GoodTimes text-3xl mb-2">OVERVIEW</h2>
              <div className="flex flex-col border-2 dark:border-0 dark:bg-[#0F152F] p-3 md:p-5 overflow-auto space-y-3 md:space-y-0">
                {isMobile ? (
                  Object.keys(citizenData)
                    .filter((v) => v != 'newsletterSub')
                    .map((v, i) => {
                      return (
                        <div
                          className="flex flex-col text-left"
                          key={'citizenData' + i}
                        >
                          <p className="text-xl capitalize">{v}:</p>

                          <p className="text-md text-balance">
                            {/**@ts-expect-error */}
                            {citizenData[v]!}
                          </p>
                        </div>
                      )
                    })
                ) : (
                  <table className="table w-fit">
                    <tbody>
                      {Object.keys(citizenData)
                        .filter((v) => v != 'newsletterSub')
                        .map((v, i) => {
                          return (
                            <tr className="" key={'citizenData' + i}>
                              <th className="text-xl dark:bg-[#0F152F]">
                                {v}:
                              </th>

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
            <div className="flex flex-col border-2 dark:border-0  dark:bg-black w-full p-3 md:p-5 mt-10 max-w-[600px]">
              <h2 className="font-GoodTimes text-3xl mb-2">IMPORTANT</h2>
              <h2 className="font-GoodTimes text-3xl mb-2">INFORMATION</h2>
              <div className="flex flex-col border-2 dark:border-0 dark:bg-[#0F152F] p-3 md:p-5 mt-5">
                <h3 className="font-GoodTimes text-2xl mb-2">MEMBERSHIP</h3>
                <p className="mt-2">
                  Membership lasts for one year and can be renewed at any
                  time. Any wallet funds are self-custodied and are not dependent on membership.
                </p>
              </div>
              <p className="mt-4">
                Welcome to the future of on-chain, off-world coordination with MoonDAO!
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
                <p className="dark:text-white">
                  I have read and accepted the terms and conditions.
                  <a
                    rel="noopener noreferrer"
                    className="text-sky-400"
                    href="https://docs.moondao.com/Legal/Website-Terms-and-Conditions"
                    target="_blank"
                  >
                    {' '}
                    Read{' '}
                  </a>{' '}
                  MoonDAO's terms and conditions.
                </p>
              </label>
            </div>
            <StageButton
              isDisabled={!agreedToCondition || isLoadingMint}
              onClick={async () => {
                //sign message

                try {
                  const cost = await citizenContract?.call('getRenewalPrice', [
                    address,
                    365 * 24 * 60 * 60,
                  ])

                  const formattedCost = ethers.utils
                    .formatEther(cost.toString())
                    .toString()

                  if (nativeBalance < formattedCost) {
                    return toast.error('Insufficient balance')
                  }

                  const accessToken = await getAccessToken()

                  //get pinata jwt
                  const jwtRes = await fetch('/api/ipfs/upload', {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                    },
                  })

                  const pinataJWT = await jwtRes.text()

                  //pin image to IPFS
                  const newImageIpfsHash = await pinImageToIPFS(
                    pinataJWT || '',
                    citizenImage,
                    citizenData.firstName + citizenData.lastName + ' Image'
                  )

                  if (!newImageIpfsHash) {
                    return toast.error('Error pinning image to IPFS')
                  }

                  //mint
                  setIsLoadingMint(true)
                  const mintTx = await citizenContract?.call(
                    'mintTo',
                    [
                      address,
                      `${citizenData.firstName} ${citizenData.lastName}`,
                      citizenData.description,
                      `ipfs://${newImageIpfsHash}`,
                      citizenData.location,
                      citizenData.discord,
                      citizenData.twitter,
                      citizenData.website,
                      citizenData.view,
                      citizenData.formResponseId,
                    ],
                    {
                      value: cost,
                    }
                  )

                  const mintedTokenId = parseInt(
                    mintTx.receipt.logs[0].topics[3],
                    16
                  ).toString()

                  setTimeout(() => {
                    setIsLoadingMint(false)
                    router.push(`/citizen/${mintedTokenId}`)
                  }, 30000)
                } catch (err) {
                  console.error(err)
                  setIsLoadingMint(false)
                }
              }}
            >
              {isLoadingMint ? 'loading...' : 'Check Out'}
            </StageButton>
          </StageContainer>
        )}
      </div>
    </div>
  )
}
