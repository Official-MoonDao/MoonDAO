import { DEFAULT_CHAIN_V5 } from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import React from 'react'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import { formatTimeUntilDeadline } from '@/lib/utils/dates'
import { truncateTokenValue } from '@/lib/utils/numbers'
import IPFSRenderer from '../layout/IPFSRenderer'
import Tooltip from '../layout/Tooltip'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import MissionFundingProgressBar from './MissionFundingProgressBar'

interface MissionProfileHeaderProps {
  mission: any
  teamNFT: any
  ruleset: any
  fundingGoal: number
  backers: any[]
  deadline: number | undefined
  stage: number
  poolDeployerAddress: string | undefined
  isManager: boolean
  availableTokens: number
  availablePayouts: number
  sendReservedTokens: () => void
  sendPayouts: () => void
  deployLiquidityPool: () => void
}

const MissionProfileHeader = React.memo(
  ({
    mission,
    teamNFT,
    ruleset,
    fundingGoal,
    backers,
    deadline,
    stage,
    poolDeployerAddress,
    isManager,
    availableTokens,
    availablePayouts,
    sendReservedTokens,
    sendPayouts,
    deployLiquidityPool,
  }: MissionProfileHeaderProps) => {
    const account = useActiveAccount()
    const { data: ethPrice } = useETHPrice(1, 'ETH_TO_USD')
    const totalFunding = useTotalFunding(mission?.projectId)

    const [duration, setDuration] = useState<any>()

    const deadlinePassed = deadline ? Date.now() > deadline : false

    useEffect(() => {
      const interval = setInterval(() => {
        if (deadline !== undefined) {
          setDuration(formatTimeUntilDeadline(new Date(deadline)))
        }
      }, 1000)
      return () => clearInterval(interval)
    }, [deadline])

    return (
      <div id="citizenheader-container" className="w-[100vw]">
        <div className="w-full">
          <div id="frame-content-container" className="w-full">
            <div
              id="frame-content"
              className="w-full sm:px-[5vw] flex flex-col lg:flex-row items-start xl:px-0 xl:w-[1200px]"
            >
              <div
                id="profile-description-section"
                className="flex w-full flex-col lg:flex-row items-start lg:items-center"
              >
                {mission?.metadata?.logoUri ? (
                  <div className="pr-0 md:pr-[2vw] pb-[5vw] md:pb-[2vw]">
                    <div
                      id="mission-image-container"
                      className="pl-0 relative w-full h-full md:min-w-[300px] md:min-h-[300px] md:max-w-[300px] md:max-h-[300px]"
                    >
                      <IPFSRenderer
                        src={mission?.metadata?.logoUri}
                        className="sm:rounded-full rounded-tr-none sm:rounded-tr-full mt-[-3vw] sm:mt-0 w-[100vw] sm:w-full h-full sm:max-w-[350px] sm:max-h-[350px]"
                        height={576}
                        width={576}
                        alt="Mission Image"
                      />
                      {teamNFT?.metadata?.image && (
                        <div
                          id="team-nft-container"
                          className="absolute bottom-0 lg:right-0 mb-[-5vw] md:mb-[-2vw] mr-[-5vw] md:mr-[-2vw]"
                        >
                          <IPFSRenderer
                            src={teamNFT?.metadata?.image}
                            className="top-[2vw] rounded-full ml-[5vw] sm:ml-0"
                            height={150}
                            width={150}
                            alt="Team Image"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <></>
                )}
                <div className="flex items-start justify-start w-full sm:w-auto">
                  <div
                    id="mission-name"
                    className="flex px-[5vw] sm:px-0 w-full flex-col justify-center lg:ml-5 max-w-[650px]"
                  >
                    <div
                      id="mission-name-container"
                      className="mt-5 lg:mt-0 flex flex-col w-full items-start justify-start"
                    >
                      {mission ? (
                        <h1 className="max-w-[450px] text-black opacity-[80%] lg:block font-GoodTimes header dark:text-white text-3xl">
                          {mission?.metadata?.name}
                        </h1>
                      ) : (
                        <></>
                      )}
                    </div>
                    <div id="profile-container">
                      {mission?.metadata?.tagline ? (
                        <p
                          id="profile-description-container"
                          className="w-full pr-12 text-gray-300 pb-5"
                        >
                          {mission?.metadata?.tagline || ''}
                        </p>
                      ) : (
                        <></>
                      )}
                    </div>

                    {ruleset && teamNFT?.metadata?.name && (
                      <div className="hidden sm:flex pb-2 flex-col sm:flex-row items-start ">
                        <p className="opacity-60">
                          {`Created on ${new Date(
                            ruleset?.[0]?.start * 1000
                          ).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })} by: `}
                        </p>
                        <Link
                          href={`/team/${generatePrettyLink(
                            teamNFT?.metadata?.name
                          )}`}
                          className="font-GoodTimes text-white underline sm:pl-2"
                        >
                          {teamNFT?.metadata?.name}
                        </Link>
                      </div>
                    )}

                    <div className="max-w-[500px] w-full bg-gradient-to-r from-[#3343A5] to-[#18183F] p-4 rounded-xl">
                      {/* Purple raised amount tag */}
                      <div className="mb-4 flex flex-col sm:flex-row md:items-center md:justify-between">
                        <div className="bg-gradient-to-r from-[#51285C] to-[#6D3F79] text-white font-GoodTimes py-2 px-6 rounded-full inline-flex items-start w-fit flex flex-col">
                          <div className="flex items-center">
                            <Image
                              src="/assets/icon-raised-tokens.svg"
                              alt="Raised"
                              width={24}
                              height={24}
                              className="mr-2"
                            />
                            <span className="mr-2">
                              {truncateTokenValue(
                                Number(totalFunding || 0) / 1e18,
                                'ETH'
                              )}
                            </span>
                            <span className="text-sm md:text-base">
                              ETH RAISED
                            </span>
                          </div>
                          <p className="font-[Lato] text-sm opacity-60">{`($${Math.round(
                            (Number(totalFunding || 0) / 1e18 || 0) * ethPrice
                          ).toLocaleString()} USD)`}</p>
                        </div>

                        {/* Contributors section - visible on md screens and above */}
                        <div className="hidden sm:flex items-center ml-2 md:mt-0">
                          <Image
                            src="/assets/icon-backers.svg"
                            alt="Backers"
                            width={24}
                            height={24}
                          />
                          <div className="mx-2">
                            <p className="sm:hidden text-gray-400 text-sm">
                              BACKERS
                            </p>
                            <p className="text-white font-GoodTimes">
                              {backers?.length || 0}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="w-full">
                        <MissionFundingProgressBar
                          fundingGoal={fundingGoal}
                          volume={Number(totalFunding || 0) / 1e18}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-between sm:justify-start">
                        <div className="flex items-center">
                          <Image
                            src="/assets/launchpad/target.svg"
                            alt="Goal"
                            width={24}
                            height={24}
                          />
                          <div className="ml-2">
                            <div className="flex items-center gap-1">
                              <p className="text-gray-400 text-sm">GOAL</p>
                              <Tooltip
                                text={`~ $${Math.round(
                                  (fundingGoal / 1e18) * ethPrice
                                ).toLocaleString()} USD`}
                                buttonClassName="scale-75"
                              >
                                ?
                              </Tooltip>
                            </div>
                            <p className="text-white font-GoodTimes">
                              {+(fundingGoal / 1e18).toFixed(3)} ETH
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center">
                          <Image
                            src="/assets/launchpad/clock.svg"
                            alt="Deadline"
                            width={24}
                            height={24}
                          />
                          <div className="ml-2">
                            <p className="text-gray-400 text-sm">DEADLINE</p>
                            <p className="text-white font-GoodTimes min-w-[250px]">
                              {stage === 3 ? 'REFUND' : duration}
                            </p>
                          </div>
                        </div>

                        {/* Contributors section - visible only on smaller screens */}
                        <div className="flex sm:hidden items-center">
                          <Image
                            src="/assets/icon-backers.svg"
                            alt="Backers"
                            width={24}
                            height={24}
                          />
                          <div className="ml-2">
                            <p className="text-gray-400 text-sm">BACKERS</p>
                            <p className="text-white font-GoodTimes">
                              {backers?.length || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {ruleset && teamNFT?.metadata?.name && (
                      <div className="flex sm:hidden pt-2 flex-col sm:flex-row items-start ">
                        <p className="opacity-60">
                          {`Created on ${new Date(
                            ruleset?.[0]?.start * 1000
                          ).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })} by: `}
                        </p>
                        <Link
                          href={`/team/${generatePrettyLink(
                            teamNFT?.metadata?.name
                          )}`}
                          className="font-GoodTimes text-white underline"
                        >
                          {teamNFT?.metadata?.name}
                        </Link>
                      </div>
                    )}
                    {/* Send payouts and tokens Buttons - only shown to managers */}
                    {account && deadlinePassed && isManager && (
                      <div className="flex flex-col gap-4 mt-8 md:-mt-8 w-full sm:w-auto sm:absolute sm:right-2 sm:top-[250px]">
                        <PrivyWeb3Button
                          requiredChain={DEFAULT_CHAIN_V5}
                          className="gradient-2 rounded-full w-full noPadding leading-none flex-1 sm:w-[250px]"
                          label={
                            <span className="whitespace-nowrap">
                              Send Tokens
                            </span>
                          }
                          action={sendReservedTokens}
                          isDisabled={!availableTokens}
                        />
                        <PrivyWeb3Button
                          requiredChain={DEFAULT_CHAIN_V5}
                          className="gradient-2 rounded-full noPadding w-full leading-none flex-1 sm:w-[250px]"
                          label={
                            <span className="whitespace-nowrap">
                              Send Payouts
                            </span>
                          }
                          action={sendPayouts}
                          isDisabled={!availablePayouts}
                        />
                        {stage === 2 && (
                          <PrivyWeb3Button
                            requiredChain={DEFAULT_CHAIN_V5}
                            className="gradient-2 rounded-full noPadding w-full leading-none flex-1 sm:w-[250px]"
                            label={
                              <span className="whitespace-nowrap">
                                Deploy Liquidity
                              </span>
                            }
                            action={deployLiquidityPool}
                            isDisabled={!poolDeployerAddress}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

MissionProfileHeader.displayName = 'MissionProfileHeader'

export default MissionProfileHeader
