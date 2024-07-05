import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import { useContract } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { TEAM_ADDRESSES, TEAM_CREATOR_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import useWindowSize from '../../lib/team/use-window-size'
import { pinImageToIPFS, pinMetadataToIPFS } from '@/lib/ipfs/pin'
import cleanData from '@/lib/tableland/cleanData'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import formatTeamFormData, { TeamData } from '@/lib/typeform/teamFormData'
import MoonDAOTeamCreatorABI from '../../const/abis/MoonDAOTeamCreator.json'
import { Steps } from '../layout/Steps'
import { StageButton } from './StageButton'
import { StageContainer } from './StageContainer'
import { ImageGenerator } from './TeamImageGenerator'
import Container from '../layout/Container'

export default function CreateTeam({
  address,
  selectedChain,
  setSelectedTier,
}: any) {
  const router = useRouter()

  const { getAccessToken } = usePrivy()

  const [stage, setStage] = useState<number>(0)
  const [lastStage, setLastStage] = useState<number>(0)

  const [teamImage, setTeamImage] = useState<any>()

  const [agreedToCondition, setAgreedToCondition] = useState<boolean>(false)

  const [isLoadingMint, setIsLoadingMint] = useState<boolean>(false)

  const checkboxRef = useRef(null)

  const { isMobile } = useWindowSize()

  const [teamData, setTeamData] = useState<TeamData>({
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

  const { contract: teamContract } = useContract(
    TEAM_ADDRESSES[selectedChain.slug]
  )

  const { contract: teamCreatorContract } = useContract(
    TEAM_CREATOR_ADDRESSES[selectedChain.slug],
    MoonDAOTeamCreatorABI
  )
  const pfpRef = useRef<HTMLDivElement | null>(null)

  const nativeBalance = useNativeBalance()

  const submitTypeform = useCallback(async (formResponse: any) => {
    const accessToken = await getAccessToken()

    //get response from form
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

    //format answers into an object
    const teamFormData = formatTeamFormData(data.answers, responseId)

    //escape single quotes and remove emojis
    const cleanedTeamFormData = cleanData(teamFormData)

    setTeamData(cleanedTeamFormData)
    setStage(2)
  }, [])

  return (
    <Container
      containerwidth
      >
      <div id="create-team-image-container" 
        className="bg-slide-section md:pt-10 flex items-start md:items-center justify-center w-full h-full"
        >
        <div className="flex flex-row">
              <div className="m-5 w-[90vw] md:w-full flex flex-col lg:max-w-[1256px] items-center">
                <div className="pl-5 flex flex-row w-full justify-between items-start">
                  <Steps
                    className="mb-4 w-[300px] sm:w-[600px] lg:max-w-[900px] md:-ml-16 -ml-10"
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
                    className={`mb-[350px] max-w-[600px]`}
                    title="Design"
                    description="Design your unique onchain registration certificate by uploading your logo or image. For best results, use an image with a white or transparent background."
                  >
                    <ImageGenerator
                      setImage={setTeamImage}
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
                        id={process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string}
                        onSubmit={submitTypeform}
                        height={700}
                      />
                    </div>
                  </StageContainer>
                )}
                {/* Pin Image and Metadata to IPFS, Mint NFT to Gnosis Safe */}
                {stage === 2 && (
                  <StageContainer
                    title="Mint Team"
                    description="Please review your onchain Team before minting."
                  >
                    {/* <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
                      {`Make sure all your information is displayed correcly.`}
                    </p>
                    <p className="mt-6 w-[400px] font-[Lato] text-base xl:text-lg lg:text-left text-left text-[#071732] dark:text-white text-opacity-70 dark:text-opacity-60">
                      {`Welcome to the future of off-world coordination with MoonDAO.`}
                    </p> */}

                    <Image
                      src={URL.createObjectURL(teamImage)}
                      alt="entity-image"
                      width={600}
                      height={600}
                    />

                    <div className="flex flex-col w-full md:p-5 mt-10 max-w-[600px]">
                      <h2 className="font-GoodTimes text-3xl mb-2">OVERVIEW</h2>
                      <div className="flex flex-col rounded-[20px] bg-[#0F152F] p-5 pb-10 md:p-5 overflow-auto space-y-3 md:space-y-0">
                        {isMobile ? (
                          Object.keys(teamData)
                            .filter((v) => v != 'formResponseId')
                            .map((v, i) => {
                              return (
                                <div
                                  className="flex flex-col text-left"
                                  key={'entityData' + i}
                                >
                                  <p className="text-xl capitalize">{v}:</p>

                                  <p className="text-md text-balance">
                                    {/**@ts-expect-error */}
                                    {teamData[v]!}
                                  </p>
                                </div>
                              )
                            })
                        ) : (
                          <table className="table w-fit">
                            <tbody>
                              {Object.keys(teamData)
                                .filter((v) => v != 'formResponseId')
                                .map((v, i) => {
                                  return (
                                    <tr className="" key={'entityData' + i}>
                                      <th className="text-xl border-2 dark:border-0 dark:bg-[#0F152F]">
                                        {v}:
                                      </th>

                                      <th className="text-md border-2 dark:border-0 dark:bg-[#0F152F] text-pretty">
                                        {/**@ts-expect-error */}
                                        {teamData[v]!}
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
                      <h2 className="font-GoodTimes text-3xl mb-2">IMPORTANT</h2>
                      <h2 className="font-GoodTimes text-3xl mb-2">INFORMATION</h2>
                      <div className="flex flex-col rounded-[20px] bg-[#0F152F] p-5 pb-10 md:p-5">
                        <h3 className="font-GoodTimes text-2xl mb-2">TREASURY</h3>
                        <p className="mt-2">
                          A self-custodied multisignature treasury will secure your
                          organization’s assets, allowing to interact with any smart
                          contracts within the Ethereum ecosystem. <br /> <br />
                          You can add more signers later via your Team management
                          portal.
                        </p>
                      </div>
                      <div className="flex flex-col bg-[#0F152F] rounded-[20px] pb-10 p-5 mt-5">
                        <h3 className="font-GoodTimes text-2xl mb-2">ADMINISTRATOR</h3>
                        <p className="mt-2">
                          The admin can modify your organization’s information. To
                          begin, the currently connected wallet will act as the
                          Administrator.
                          <br /> <br />
                          You can change the admin or add more members to your
                          organization using the Hats Protocol within your Team
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
                            href="https://docs.moondao.com/Legal/Website-Privacy-Policy"
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
                        try {
                          const cost = await teamContract?.call('getRenewalPrice', [
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

                          const adminHatMetadataIpfsHash = await pinMetadataToIPFS(
                            pinataJWT || '',
                            {
                              type: '1.0',
                              data: {
                                name: teamData.name + ' Admin',
                                description: teamData.description,
                              },
                            },
                            teamData.name + 'Admin Hat Metadata'
                          )

                          const managerHatMetadataIpfsHash = await pinMetadataToIPFS(
                            pinataJWT || '',
                            {
                              type: '1.0',
                              data: {
                                name: teamData.name + ' Manager',
                                description: teamData.description,
                              },
                            },
                            teamData.name + 'Manager Hat Metadata'
                          )

                          //pin image to IPFS
                          const newImageIpfsHash = await pinImageToIPFS(
                            pinataJWT || '',
                            teamImage,
                            teamData.name + ' Image'
                          )

                          if (!newImageIpfsHash) {
                            return toast.error('Error pinning image to IPFS')
                          }

                          setIsLoadingMint(true)
                          //mint NFT to safe
                          const mintTx = await teamCreatorContract?.call(
                            'createMoonDAOEntity',
                            [
                              'ipfs://' + adminHatMetadataIpfsHash,
                              'ipfs://' + managerHatMetadataIpfsHash,
                              teamData.name,
                              teamData.description,
                              `ipfs://${newImageIpfsHash}`,
                              teamData.twitter,
                              teamData.communications,
                              teamData.website,
                              teamData.view,
                              teamData.formResponseId,
                            ],
                            {
                              value: cost,
                            }
                          )

                          const mintedTokenId = parseInt(
                            mintTx.receipt.logs[9].topics[3],
                            16
                          ).toString()

                          setTimeout(() => {
                            setIsLoadingMint(false)
                            router.push(`/team/${mintedTokenId}`)
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
      </div>      
    </Container>
    
  )
}

