import { XMarkIcon } from '@heroicons/react/24/outline'
import { getAccessToken, useFundWallet } from '@privy-io/react-auth'
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
import viemChains from '@/lib/viem/viemChains'
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
    try {
      //get response from form
      const { formId, responseId } = formResponse

      await waitForResponse(formId, responseId)

      const accessToken = await getAccessToken()

      const responseRes = await fetch(`/api/typeform/response`, {
        body: JSON.stringify({
          accessToken: accessToken,
          responseId: responseId,
          formId: formId,
        }),
        method: 'POST',
      })

      if (!responseRes.ok) {
        throw new Error(`API call failed with status: ${responseRes.status}`)
      }

      const data = await responseRes.json()

      if (!data.answers) {
        throw new Error('No answers found in response')
      }

      //format answers into an object
      const teamFormData = formatTeamFormData(data.answers, responseId)

      //escape single quotes and remove emojis
      const cleanedTeamFormData = cleanData(teamFormData)

      setTeamData(cleanedTeamFormData)
      setStage(2)
    } catch (error) {
      console.error('Error submitting typeform:', error)
      // You might want to show an error message to the user here
      alert(
        'There was an error processing your form submission. Please try again.'
      )
    }
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
          <div className="flex flex-row w-full justify-center">
            <div className="px-8 bg-black/20 backdrop-blur-sm border border-white/10 lg:p-8 rounded-[2vmax] md:m-5 mb-0 md:mb-0 flex flex-col w-full max-w-[800px]">
              <div className="flex p-2 pb-0 flex-row w-full justify-between items-start">
                <Steps
                  className="mb-4 w-[300px] sm:w-[600px] lg:max-w-[900px] md:-ml-16 -ml-10"
                  steps={['Design', 'Profile', 'Checkout']}
                  currStep={stage}
                  lastStep={lastStage}
                  setStep={setStage}
                />
                <button
                  onClick={() => setSelectedTier(null)}
                  className="hover:scale-110 transition-transform"
                >
                  <XMarkIcon width={50} height={50} className="text-white" />
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
                  title="Team Profile"
                  description="Please complete your team profile by filling out the form below."
                >
                  <div className="w-full bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden relative">
                    <Widget
                      className="w-full"
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
                  title="Review & Mint"
                  description="Please review your team information before finalizing your registration on the blockchain."
                >
                  {teamImage && (
                    <div className="w-full bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
                      <h3 className="text-lg font-semibold text-white mb-4">
                        Team Image Preview
                      </h3>
                      <div className="flex justify-start">
                        <Image
                          src={URL.createObjectURL(teamImage)}
                          alt="entity-image"
                          width={300}
                          height={300}
                          className="rounded-xl border border-slate-600/50"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col w-full md:p-5 mt-8 max-w-[600px]">
                    <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                      <h3 className="font-GoodTimes text-xl mb-4 text-white">
                        Team Overview
                      </h3>
                      <div className="grid gap-4">
                        {isMobile ? (
                          Object.keys(teamData)
                            .filter((v) => v != 'formResponseId')
                            .map((v, i) => {
                              return (
                                <div
                                  className="flex flex-col p-4 bg-slate-800/50 rounded-lg border border-slate-600/30"
                                  key={'entityData' + i}
                                >
                                  <p className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-1">
                                    {v}:
                                  </p>
                                  <p className="text-white">
                                    {/**@ts-expect-error */}
                                    {teamData[v]!}
                                  </p>
                                </div>
                              )
                            })
                        ) : (
                          <div className="space-y-3">
                            {Object.keys(teamData)
                              .filter((v) => v != 'formResponseId')
                              .map((v, i) => {
                                return (
                                  <div
                                    className="flex justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-600/30"
                                    key={'entityData' + i}
                                  >
                                    <span className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                                      {v}:
                                    </span>
                                    <span className="text-white max-w-xs text-right">
                                      {/**@ts-expect-error */}
                                      {teamData[v]!}
                                    </span>
                                  </div>
                                )
                              })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col w-full md:p-5 mt-8 max-w-[600px]">
                    <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                      <h2 className="font-GoodTimes text-xl mb-6 text-white">
                        Important Information
                      </h2>
                      <div className="flex flex-col rounded-[20px] bg-slate-800/50 border border-slate-600/30 p-5 pb-10 md:p-5">
                        <h3 className="font-GoodTimes text-lg mb-3 text-white">
                          Treasury
                        </h3>
                        <p className="text-slate-300 leading-relaxed">
                          A self-custodied multisignature treasury will secure
                          your organization’s assets, allowing interaction with
                          any smart contracts within the Ethereum ecosystem.
                          <br />
                          <br />
                          You can add more signers later via your Team
                          management portal.
                        </p>
                      </div>
                      <div className="flex flex-col bg-slate-800/50 border border-slate-600/30 rounded-[20px] pb-10 p-5 mt-5">
                        <h3 className="font-GoodTimes text-lg mb-3 text-white">
                          Manager
                        </h3>
                        <p className="text-slate-300 leading-relaxed">
                          The manager can modify your organization’s
                          information. To begin, the currently connected wallet
                          will act as the Manager.
                          <br />
                          <br />
                          You can add a manager or members to your organization
                          using your Team Management Portal.
                        </p>
                      </div>
                      <p className="mt-6 text-center text-slate-300 font-medium">
                        Welcome to the future of on-chain, off-world
                        coordination with MoonDAO!
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-row items-center mt-6 p-4 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl">
                    <label
                      className="relative flex items-center p-3 rounded-full cursor-pointer"
                      htmlFor="link"
                    >
                      <input
                        checked={agreedToCondition}
                        onChange={(e) => setAgreedToCondition(e.target.checked)}
                        type="checkbox"
                        className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-400 transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-slate-500 before:opacity-0 before:transition-opacity checked:border-slate-300 checked:bg-slate-700 checked:before:bg-slate-700 hover:before:opacity-10"
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
                      className="mt-px font-light text-slate-300 select-none max-w-[550px]"
                      htmlFor="link"
                    >
                      <p className="text-white">
                        I have read and accepted the
                        <Link
                          rel="noopener noreferrer"
                          className="text-sky-400 hover:text-sky-300 transition-colors"
                          href="/terms-of-service"
                        >
                          {' '}
                          Terms and Conditions{' '}
                        </Link>{' '}
                        and the{' '}
                        <Link
                          className="text-sky-400 hover:text-sky-300 transition-colors"
                          href="/privacy-policy"
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
                    label="Create Team"
                    className="mt-6 w-auto px-8 py-2 gradient-2 hover:scale-105 transition-transform rounded-xl font-medium text-base"
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
                            chain: viemChains[chainSlug],
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
                            // HatURIs struct
                            {
                              adminHatURI: 'ipfs://' + adminHatMetadataIpfsHash,
                              managerHatURI:
                                'ipfs://' + managerHatMetadataIpfsHash,
                              memberHatURI:
                                'ipfs://' + memberHatMetadataIpfsHash,
                            },
                            // TeamMetadata struct
                            {
                              name: teamData.name,
                              bio: teamData.description,
                              image: 'ipfs://' + newImageIpfsHash,
                              twitter: teamData.twitter,
                              communications: teamData.communications,
                              website: teamData.website,
                              _view: teamData.view,
                              formId: teamData.formResponseId,
                            },
                            // members array
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
                    <div className="mt-4 p-4 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl">
                      <p className="text-slate-300 text-center">
                        Creating your team on the blockchain...
                      </p>
                      <p className="text-slate-400 text-sm text-center mt-2">
                        This process can take up to a minute. Please wait while
                        the transaction is processed.
                      </p>
                    </div>
                  )}
                </StageContainer>
              )}
            </div>
          </div>
          {/* Dev Buttons */}
          {process.env.NEXT_PUBLIC_ENV === 'dev' && (
            <div className="flex flex-row justify-center gap-4">
              <button id="team-back-button" onClick={() => setStage(stage - 1)}>
                BACK
              </button>
              <button id="team-next-button" onClick={() => setStage(stage + 1)}>
                NEXT
              </button>
            </div>
          )}
        </ContentLayout>
      </div>
    </Container>
  )
}
