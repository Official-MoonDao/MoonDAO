import { XMarkIcon } from '@heroicons/react/24/outline'
import { useFundWallet, usePrivy } from '@privy-io/react-auth'
import { useContract } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import {
  CITIZEN_ADDRESSES,
  CK_NETWORK_SIGNUP_FORM_ID,
  CK_NETWORK_SIGNUP_TAG_ID,
} from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import useWindowSize from '../../lib/team/use-window-size'
import useSubscribe from '@/lib/convert-kit/useSubscribe'
import useTag from '@/lib/convert-kit/useTag'
import useImageGenerator from '@/lib/image-generator/useImageGenerator'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { createSession, destroySession } from '@/lib/iron-session/iron-session'
import cleanData from '@/lib/tableland/cleanData'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import {
  CitizenData,
  formatCitizenShortFormData,
} from '@/lib/typeform/citizenFormData'
import waitForResponse from '@/lib/typeform/waitForResponse'
import { renameFile } from '@/lib/utils/files'
import CitizenABI from '../../const/abis/Citizen.json'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import FileInput from '../layout/FileInput'
import Footer from '../layout/Footer'
import StandardButton from '../layout/StandardButton'
import { Steps } from '../layout/Steps'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { ImageGenerator } from './CitizenImageGenerator'
import { StageButton } from './StageButton'
import { StageContainer } from './StageContainer'

export default function CreateCitizen({
  address,
  selectedChain,
  setSelectedTier,
}: any) {
  const router = useRouter()

  const { getAccessToken } = usePrivy()

  const [stage, setStage] = useState<number>(0)
  const [lastStage, setLastStage] = useState<number>(0)

  //Input Image for Image Generator
  const [inputImage, setInputImage] = useState<File>()
  //Final Image for Citizen Profile
  const [citizenImage, setCitizenImage] = useState<any>()
  const {
    generateImage,
    isLoading: generating,
    error: generateError,
  } = useImageGenerator(
    '/api/image-gen/citizen-image',
    inputImage,
    setCitizenImage
  )

  const [citizenData, setCitizenData] = useState<CitizenData>({
    name: '',
    email: '',
    description: '',
    location: '',
    view: '',
    discord: '',
    website: '',
    twitter: '',
    formResponseId: '',
  })
  const [agreedToCondition, setAgreedToCondition] = useState<boolean>(false)

  const [isLoadingMint, setIsLoadingMint] = useState<boolean>(false)

  const { fundWallet } = useFundWallet()

  const { isMobile } = useWindowSize()

  useEffect(() => {
    if (stage > lastStage) {
      setLastStage(stage)
    }
  }, [stage, lastStage])

  const { contract: citizenContract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug],
    CitizenABI
  )

  const pfpRef = useRef<HTMLDivElement | null>(null)

  const subscribeToNetworkSignup = useSubscribe(CK_NETWORK_SIGNUP_FORM_ID)
  const tagToNetworkSignup = useTag(CK_NETWORK_SIGNUP_TAG_ID)

  const nativeBalance = useNativeBalance()

  const submitTypeform = useCallback(async (formResponse: any) => {
    const accessToken = await getAccessToken()
    await createSession(accessToken)

    const { formId, responseId } = formResponse

    await waitForResponse(formId, responseId, accessToken)

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

    //fomat answers into an object
    const citizenShortFormData = formatCitizenShortFormData(
      data.answers,
      responseId
    )

    //subscribe to newsletter
    const subRes = await subscribeToNetworkSignup(citizenShortFormData.email)
    if (subRes.ok) {
      console.log('Subscribed to network signup')
    }

    //escape single quotes and remove emojis
    const cleanedCitizenShortFormData = cleanData(citizenShortFormData)

    setCitizenData(cleanedCitizenShortFormData as any)

    setStage(2)
    await destroySession(accessToken)
  }, [])

  return (
    <Container>
      <ContentLayout
        isProfile
        mode="compact"
        header="Join The Network"
        mainPadding
        headerSize="max(20px, 3vw)"
        preFooter={
          <>
            <Footer></Footer>
          </>
        }
        description=""
      >
        <div className="flex flex-row w-full">
          <div className="px-5 bg-slide-section lg:p-5 rounded-tl-[20px] rounded-[5vmax] md:m-5 mb-0 md:mb-0 w-full flex flex-col lg:max-w-[1200px]">
            <div className="flex p-2 pb-0 flex-row w-full justify-between max-w-[600px] items-start">
              <Steps
                className="mb-4 pl-5 md:pl-0 w-[300px] sm:w-[600px] lg:w-[800px] md:-ml-16"
                steps={['Design', 'Profile', 'Checkout']}
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
                className={`mb-10`}
                title="Design"
                description={
                  <>
                    <b>
                      Create your unique and personalized AI passport photo.
                    </b>{' '}
                    The uploaded photo <u>MUST</u> contain a face, but it can be
                    a photo of yourself or an avatar that represents you well.
                    Image generation may take up to a minute, so please continue
                    to the next step to fill out your profile.
                  </>
                }
              >
                <ImageGenerator
                  image={citizenImage}
                  setImage={setCitizenImage}
                  inputImage={inputImage}
                  setInputImage={setInputImage}
                  nextStage={() => setStage(1)}
                  stage={stage}
                  generateInBG
                />
                {process.env.NEXT_PUBLIC_ENV === 'dev' && (
                  <button
                    onClick={() => {
                      setCitizenData({
                        name: 'Test',
                        description: 'Testing',
                        email: 'test@test.com',
                        discord: '',
                        website: 'https://moondao.com',
                        twitter: '',
                        location: 'Earth',
                        view: 'public',
                        formResponseId: '0000',
                      })

                      const file = new File([''], 'test.png', {
                        type: 'image/png',
                      })

                      setCitizenImage(file)
                      setStage(2)
                    }}
                  >
                    Use Testing Data
                  </button>
                )}
              </StageContainer>
            )}
            {/* Upload & Create Image */}
            {stage === 1 && (
              <StageContainer description="Please complete your citizen profile.">
                <div className="w-full">
                  <Widget
                    className="w-[100%]"
                    id={
                      process.env
                        .NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID as string
                    }
                    onSubmit={submitTypeform}
                    height={700}
                  />
                </div>
              </StageContainer>
            )}
            {/* Pin Image and Metadata to IPFS, Mint NFT to Gnosis Safe */}
            {stage === 2 && (
              <StageContainer
                title="Mint Citizen"
                description="Please review your onchain profile before finalizing your registration"
              >
                {/* <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
                  {`Make sure all your information is displayed correcly.`}
                </p>
                <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
                  {`Welcome to the future of off-world coordination with MoonDAO.`}
                </p> */}
                <div className="flex flex-col items-center">
                  <Image
                    src={
                      citizenImage
                        ? URL.createObjectURL(citizenImage)
                        : '/assets/MoonDAO-Loading-Animation.svg'
                    }
                    alt="citizen-image"
                    width={600}
                    height={600}
                  />

                  {!citizenImage && (
                    <p className="mt-2 opacity-[50%]">
                      {
                        'Please note that it may take up to a couple of minutes for your image to be generated.'
                      }
                    </p>
                  )}
                  {inputImage?.name === citizenImage?.name || generateError ? (
                    <p className="mt-2 w-full text-left opacity-[50%]">
                      {
                        'Unable to generate an image, please try again later, or proceed with checkout to use the image above.'
                      }
                    </p>
                  ) : (
                    <></>
                  )}
                </div>
                {citizenImage && (
                  <div className="mt-4">
                    <FileInput file={inputImage} setFile={setInputImage} />
                    <StageButton
                      onClick={() => {
                        setCitizenImage(null)
                        generateImage()
                      }}
                    >
                      Regenerate
                    </StageButton>
                  </div>
                )}

                <div className="flex flex-col w-full md:p-5 mt-10 max-w-[600px]">
                  <h2 className="font-GoodTimes text-3xl mb-2">OVERVIEW</h2>
                  <div className="flex flex-col dark:bg-[#0F152F] p-5 pb-10 rounded-[20px] md:p-5 overflow-auto space-y-3 md:space-y-0">
                    {isMobile ? (
                      Object.keys(citizenData)
                        .filter(
                          (v) => v != 'newsletterSub' && v != 'formResponseId'
                        )
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
                            .filter(
                              (v) =>
                                v != 'newsletterSub' && v != 'formResponseId'
                            )
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
                <div className="flex flex-col w-full md:p-5 mt-10 max-w-[600px]">
                  <h2 className="font-GoodTimes text-3xl mb-2">
                    IMPORTANT INFORMATION
                  </h2>
                  <div className="flex flex-col dark:bg-[#0F152F] p-5 pb-10 rounded-[20px] md:p-5 mt-5">
                    <h3 className="font-GoodTimes text-2xl mb-2">
                      CITIZENSHIP
                    </h3>
                    <p className="mt-2">
                      Citizenship lasts for one year and can be renewed at any
                      time. Any wallet funds are self-custodied and are not
                      dependent on registration.
                    </p>
                  </div>
                  <p className="mt-4">
                    Welcome to the future of on-chain, off-world coordination
                    with MoonDAO!
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
                      I have read and accepted the
                      <Link
                        rel="noopener noreferrer"
                        className="text-sky-400"
                        href="https://docs.moondao.com/Legal/Website-Terms-and-Conditions"
                        target="_blank"
                      >
                        {' '}
                        Terms and Conditions{' '}
                      </Link>{' '}
                      and the{' '}
                      <Link
                        className="text-sky-400"
                        href="https://docs.moondao.com/Legal/Website-Privacy-Policy"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </p>
                  </label>
                </div>
                <PrivyWeb3Button
                  id="citizen-checkout-button"
                  label="Check Out"
                  isDisabled={!agreedToCondition || isLoadingMint}
                  action={async () => {
                    const accessToken = await getAccessToken()
                    await createSession(accessToken)

                    if (!citizenImage)
                      return toast.error(
                        'Please wait for your image to finish generating.'
                      )

                    try {
                      const cost = await citizenContract?.call(
                        'getRenewalPrice',
                        [address, 365 * 24 * 60 * 60]
                      )

                      const formattedCost = ethers.utils
                        .formatEther(cost.toString())
                        .toString()

                      const estimatedMaxGas = 0.0001

                      const totalCost = Number(formattedCost) + estimatedMaxGas

                      if (nativeBalance < totalCost) {
                        const roundedCost =
                          Math.ceil(+totalCost * 10000) / 10000

                        return await fundWallet(address, {
                          amount: String(roundedCost),
                        })
                      }

                      const renamedCitizenImage = renameFile(
                        citizenImage,
                        `${citizenData.name} Citizen Image`
                      )

                      const { cid: newImageIpfsHash } = await pinBlobOrFile(
                        renamedCitizenImage
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
                          citizenData.name,
                          '',
                          `ipfs://${newImageIpfsHash}`,
                          '',
                          '',
                          '',
                          '',
                          'public',
                          citizenData.formResponseId,
                        ],
                        {
                          value: cost,
                          gasLimit: 1000000,
                        }
                      )

                      const mintedTokenId = parseInt(
                        mintTx.receipt.logs[0].topics[3],
                        16
                      ).toString()

                      if (mintedTokenId) {
                        await tagToNetworkSignup(citizenData.email)
                      }

                      setTimeout(() => {
                        setIsLoadingMint(false)
                        router.push(`/citizen/${mintedTokenId}`)
                      }, 30000)
                    } catch (err) {
                      console.error(err)
                      setIsLoadingMint(false)
                    }
                    await destroySession(accessToken)
                  }}
                />
                {isLoadingMint && (
                  <p className="opacity-[50%]">
                    {
                      'On-chain registration can take up to a minute, please wait while the transaction is processed.'
                    }
                  </p>
                )}
              </StageContainer>
            )}
          </div>
        </div>
        {/* Dev Buttons */}
        {process.env.NEXT_PUBLIC_ENV === 'dev' && (
          <div className="flex flex-row justify-center gap-4">
            <button onClick={() => setStage(stage - 1)}>BACK</button>
            <button onClick={() => setStage(stage + 1)}>NEXT</button>
          </div>
        )}
      </ContentLayout>
    </Container>
  )
}
