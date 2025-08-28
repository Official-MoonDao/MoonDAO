//This component dipslays a project card using project data directly from tableland
import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import Link from 'next/link'
import React, { useContext, memo, useState, useMemo, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useActiveAccount } from 'thirdweb/react'
import { useSubHats } from '@/lib/hats/useSubHats'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { normalizeJsonString } from '@/lib/utils/rewards'
import IPFSRenderer from '@/components/layout/IPFSRenderer'
import Finalist from '@/components/wba/Finalist'
import NumberStepper from '../layout/NumberStepper'
import StandardButton from '../layout/StandardButton'

type FinalistCardProps = {
  finalist: Finalist | undefined
  distribute?: boolean
  distribution?: Record<string, number>
  handleDistributionChange?: (finalistId: string, value: number) => void
  userHasVotingPower?: any
  isVotingPeriod?: boolean
}

const FinalistCardContent = memo(
  ({
    finalist,
    distribution,
    handleDistributionChange,
    distribute,
    userHasVotingPower,
    isVotingPeriod,
    ineligible,
  }: any) => {
    const [isExpanded, setIsExpanded] = useState(false)
    // Set character limits that better match the compact card height
    const [characterLimit, setCharacterLimit] = useState(400)
    useEffect(() => {
      const handleResize = () => {
        if (typeof window !== 'undefined') {
          // Adjust limits for the more compact 240px height
          setCharacterLimit(window.innerWidth >= 1024 ? 450 : 400)
        }
      }

      if (typeof window !== 'undefined') {
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
      }
    }, [])

    return (
      <div
        id="card-container"
        className="p-2 flex flex-col gap-2 relative  overflow-hidden"
      >
        <div className="flex justify-between">
          <div className="w-full flex flex-row gap-2">
            <Image
              className="rounded-2xl border-4 border-slate-500/50"
              src={getIPFSGateway(finalist.image)}
              alt="Citizen Image"
              height={66}
              width={66}
            />
            <div className="flex flex-col">
              <Link href={`/citizen/${finalist?.id}`} passHref>
                <h1 className="font-GoodTimes">{finalist?.name || ''}</h1>
              </Link>
              <div className="flex flex-row">
                {finalist?.videoUrl ? (
                  <StandardButton
                    className={`gradient-2 w-fit font-[14px] ${
                      distribute && 'mr-4'
                    }`}
                    link={finalist?.videoUrl}
                    onClick={(e: any) => {
                      e.stopPropagation()
                    }}
                    hoverEffect={false}
                    target={'_blank'}
                  >
                    <p className="text-[14px]">Video Response</p>
                  </StandardButton>
                ) : (
                  <></>
                )}
                {finalist?.writtenUrl ? (
                  <StandardButton
                    className={`gradient-2 w-fit font-[14px] ${
                      distribute && 'mr-4'
                    }`}
                    link={finalist?.writtenUrl}
                    onClick={(e: any) => {
                      e.stopPropagation()
                    }}
                    hoverEffect={false}
                    target={'_blank'}
                  >
                    <p className="text-[14px]">Written Response</p>
                  </StandardButton>
                ) : (
                  <></>
                )}
              </div>
            </div>
          </div>
          {distribute &&
            (ineligible ? (
              <div className="flex flex-col items-end">
                <p className="text-gray-400">{'Ineligible'}</p>
              </div>
            ) : (
              <NumberStepper
                number={distribution?.[finalist?.id] || 0}
                setNumber={(value: any) => {
                  if (distribution && handleDistributionChange) {
                    handleDistributionChange(String(finalist?.id), value)
                  }
                }}
                step={1}
                min={0}
                max={100}
                isDisabled={!userHasVotingPower}
              />
            ))}
          {!distribute && isVotingPeriod && (
            <div className="flex flex-col items-end">
              <p className="text-gray-400 text-sm">Not Eligible</p>
            </div>
          )}
        </div>
      </div>
    )
  }
)
FinalistCardContent.displayName = 'FinalistCardContent'

export default function FinalistCard({
  finalist,
  distribute,
  distribution,
  handleDistributionChange,
  userHasVotingPower,
  isVotingPeriod,
}: FinalistCardProps) {
  const account = useActiveAccount()
  const address = account?.address

  const { authenticated } = usePrivy()
  const { selectedChain } = useContext(ChainContextV5)
  const ineligible =
    address && finalist.address.toLowerCase() == address.toLowerCase()

  return (
    <>
      {distribute ? (
        <FinalistCardContent
          finalist={finalist}
          distribute={distribute}
          ineligible={ineligible}
          distribution={distribution}
          handleDistributionChange={handleDistributionChange}
          userHasVotingPower={userHasVotingPower}
          isVotingPeriod={isVotingPeriod}
        />
      ) : (
        <Link href={`/citizen/${finalist.citizenId}`} passHref>
          <FinalistCardContent
            finalist={finalist}
            userHasVotingPower={userHasVotingPower}
            isVotingPeriod={isVotingPeriod}
          />
        </Link>
      )}
    </>
  )
}
