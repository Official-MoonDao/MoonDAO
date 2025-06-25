import { XMarkIcon } from '@heroicons/react/24/outline'
import { useFundWallet } from '@privy-io/react-auth'
import { Widget } from '@typeform/embed-react'
import {
  DEPLOYED_ORIGIN,
  DISCORD_CITIZEN_ROLE_ID,
  TEAM_ADDRESSES,
  TEAM_CREATOR_ADDRESSES,
} from 'const/config'
import { ethers } from 'ethers'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useWindowSize from '../../lib/team/use-window-size'
import sendDiscordMessage from '@/lib/discord/sendDiscordMessage'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import cleanData from '@/lib/tableland/cleanData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import waitForERC721 from '@/lib/thirdweb/waitForERC721'
import formatTeamFormData, { TeamData } from '@/lib/typeform/teamFormData'
import waitForResponse from '@/lib/typeform/waitForResponse'
import { renameFile } from '@/lib/utils/files'
import MoonDAOTeamCreatorABI from '../../const/abis/MoonDAOTeamCreator.json'
import TeamABI from '../../const/abis/Team.json'
import Container from '../layout/Container'
import ContentLayout from '../layout/ContentLayout'
import { ExpandedFooter } from '../layout/ExpandedFooter'
import { Steps } from '../layout/Steps'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { StageContainer } from './StageContainer'
import { ImageGenerator } from './TeamImageGenerator'

export default function CreateTeam({ selectedChain, setSelectedTier }: any) {
  const router = useRouter()

  const chainSlug = getChainSlug(selectedChain)

  const account = useActiveAccount()
  const address = account?.address

  const [stage, setStage] = useState<number>(0)
  const [lastStage, setLastStage] = useState<number>(0)

  const [teamImage, setTeamImage] = useState<any>()

  const [agreedToCondition, setAgreedToCondition] = useState<boolean>(false)

  const [isLoadingMint, setIsLoadingMint] = useState<boolean>(false)

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

  useEffect(() => {
    if (stage > lastStage) {
      setLastStage(stage)
    }
  }, [stage, lastStage])

  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI,
    chain: selectedChain,
  })

  const teamCreatorContract = useContract({
    address: TEAM_CREATOR_ADDRESSES[chainSlug],
    abi: MoonDAOTeamCreatorABI,
    chain: selectedChain,
  })

  const nativeBalance = useNativeBalance()

  const { fundWallet } = useFundWallet()

  const submitTypeform = useCallback(async (formResponse: any) => {
    //get response from form
    const { formId, responseId } = formResponse

    await waitForResponse(formId, responseId)

    const responseRes = await fetch(
      `/api/typeform/response?formId=${formId}&responseId=${responseId}`,
      {
        method: 'POST',
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
    <Container>
      <div id="create-team-image-container">
        <ContentLayout
          isProfile
          mode="compact"
          header="Join The Network"
          mainPadding
          headerSize="max(20px, 3vw)"
          preFooter={
            <>
              <ExpandedFooter 
                callToActionImage="/assets/MoonDAO-Logo-White.svg"
                callToActionTitle="Join the Network"
                callToActionButtonText="Learn More"
                callToActionButtonLink="/join"
                hasCallToAction={true}
                darkBackground={true}
                isFullwidth={false}
              />
            </>
          }
          description=""
        >
          <div className="flex flex-row w-full">
            <div className="px-5 bg-slide-section lg:p-5 rounded-tl-[20px] rounded-[5vmax] md:m-5 mb-0 md:mb-0 w-full flex flex-col lg:max-w-[1200px]">
              <div className="flex p-2 pb-0 flex-row w-full justify-between max-w-[600px] items-start">
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
                  description="Design your unique onchain registration by uploading your logo or image. For best results, use an image with a white or transparent background."
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
                  description="Please complete your team profile."
                >
                  <div className="w-full">
                    <Widget
                      className="w-[100%] md:w-[100%]"
                      id={
                        process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string
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
                  title="Mint Team"
                  description="Please review your onchain profile before finalizing your registration."
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
                    <div className="flex flex-col dark:bg-[#0F152F] p-5 pb-10 rounded-[20px] md:p-5 overflow-auto space-y-3 md:space-y-0">
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
                                    <th className="text-xl bg-[#0F152F]">
                                      {v}:
                                    </th>

                                    <th className="text-md dark:bg-[#0F152F]">
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
                    <h2 className="font-GoodTimes text-3xl mb-2">
                      IMPORTANT INFORMATION
                    </h2>
                    <div className="flex flex-col rounded-[20px] bg-[#0F152F] p-5 pb-10 md:p-5">
                      <h3 className="font-GoodTimes text-2xl mb-2">TREASURY</h3>
                      <p className="mt-2">
                        A self-custodied multisignature treasury will secure
                        your organization’s assets, allowing interaction with
                        any smart contracts within the Ethereum ecosystem.{' '}
                        <br /> <br />
                        You can add more signers later via your Team management
                        portal.
                      </p>
                    </div>
                    <div className="flex flex-col bg-[#0F152F] rounded-[20px] pb-10 p-5 mt-5">
                      <h3 className="font-GoodTimes text-2xl mb-2">MANAGER</h3>
                      <p className="mt-2">
                        The manager can modify your organization’s information.
                        To begin, the currently connected wallet will act as the
                        Manager.
                        <br /> <br />
                        You can add a manager or members to your organization
                        using your Team Management Portal.
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
                    id="team-checkout-button"
                    label="Check Out"
                    isDisabled={!agreedToCondition || isLoadingMint}
                    action={async () => {
                      if (!account || !address) {
                        return toast.error(
                          'Please connect your wallet to continue.'
                        )
                      }
                      try {
                        const cost: any = await readContract({
                          contract: teamContract,
                          method: 'getRenewalPrice' as string,
                          params: [address, 365 * 24 * 60 * 60],
                        })

                        const formattedCost = ethers.utils
                          .formatEther(cost.toString())
                          .toString()

                        const estimatedMaxGas = 0.0003

                        const totalCost =
                          Number(formattedCost) + estimatedMaxGas

                        if (+nativeBalance < totalCost) {
                          const roundedCost =
                            Math.ceil(+totalCost * 1000000) / 1000000

                          return await fundWallet(address, {
                            amount: String(roundedCost),
                          })
                        }

                        const adminHatMetadataBlob = new Blob(
                          [
                            JSON.stringify({
                              type: '1.0',
                              data: {
                                name: teamData.name + ' Admin',
                                description: teamData.description,
                              },
                            }),
                          ],
                          {
                            type: 'application/json',
                          }
                        )

                        const { cid: adminHatMetadataIpfsHash } =
                          await pinBlobOrFile(adminHatMetadataBlob)

                        const managerHatMetadataBlob = new Blob(
                          [
                            JSON.stringify({
                              type: '1.0',
                              data: {
                                name: teamData.name + ' Manager',
                                description: teamData.description,
                              },
                            }),
                          ],
                          {
                            type: 'application/json',
                          }
                        )

                        const { cid: managerHatMetadataIpfsHash } =
                          await pinBlobOrFile(managerHatMetadataBlob)

                        const memberHatMetadataBlob = new Blob(
                          [
                            JSON.stringify({
                              type: '1.0',
                              data: {
                                name: teamData.name + ' Member',
                                description: teamData.description,
                              },
                            }),
                          ],
                          {
                            type: 'application/json',
                          }
                        )

                        const { cid: memberHatMetadataIpfsHash } =
                          await pinBlobOrFile(memberHatMetadataBlob)

                        //pin image to IPFS

                        const renamedTeamImage = renameFile(
                          teamImage,
                          `${teamData.name} Team Image`
                        )

                        const { cid: newImageIpfsHash } = await pinBlobOrFile(
                          renamedTeamImage
                        )

                        if (!newImageIpfsHash) {
                          return toast.error('Error pinning image to IPFS.')
                        }

                        setIsLoadingMint(true)
                        //mint NFT to safe

                        const transaction = prepareContractCall({
                          contract: teamCreatorContract,
                          method: 'createMoonDAOTeam' as string,
                          params: [
                            'ipfs://' + adminHatMetadataIpfsHash,
                            'ipfs://' + managerHatMetadataIpfsHash,
                            'ipfs://' + memberHatMetadataIpfsHash,
                            teamData.name,
                            teamData.description,
                            'ipfs://' + newImageIpfsHash,
                            teamData.twitter,
                            teamData.communications,
                            teamData.website,
                            teamData.view,
                            teamData.formResponseId,
                            [],
                          ],
                          value: cost,
                        })

                        const receipt: any = await sendAndConfirmTransaction({
                          transaction,
                          account,
                        })

                        // Define the event signature for the Transfer event
                        const transferEventSignature = ethers.utils.id(
                          'Transfer(address,address,uint256)'
                        )
                        // Find the log that matches the Transfer event signature
                        const transferLog = receipt.logs.find(
                          (log: any) => log.topics[0] === transferEventSignature
                        )

                        const mintedTokenId = ethers.BigNumber.from(
                          transferLog.topics[3]
                        ).toString()

                        if (mintedTokenId) {
                          const teamNFT = await waitForERC721(
                            teamContract,
                            mintedTokenId
                          )
                          const teamName = teamData.name
                          const teamPrettyLink = generatePrettyLink(teamName)
                          setTimeout(async () => {
                            await sendDiscordMessage(
                              'networkNotifications',
                              `## [**${teamName}**](${DEPLOYED_ORIGIN}/team/${teamPrettyLink}?_timestamp=123456789) has created a team in the Space Acceleration Network! <@&${DISCORD_CITIZEN_ROLE_ID}>`
                            )

                            router.push(`/team/${teamPrettyLink}`)
                            setIsLoadingMint(false)
                          }, 10000)
                        }
                      } catch (err) {
                        console.error(err)
                        setIsLoadingMint(false)
                      }
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
      </div>
    </Container>
  )
}
