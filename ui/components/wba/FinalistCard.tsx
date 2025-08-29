import Image from 'next/image'
import Link from 'next/link'
import { useContext, memo, useState, useEffect } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { Finalist } from '@/components/wba/Finalist'
import NumberStepper from '../layout/NumberStepper'
import StandardButton from '../layout/StandardButton'

type FinalistCardProps = {
  finalist: Finalist | undefined
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
    userHasVotingPower,
    isVotingPeriod,
    ineligible,
  }: any) => {
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
                <StandardButton
                  className={`gradient-2 w-fit font-[14px] mr-4`}
                  link={finalist?.videoUrl}
                  onClick={(e: any) => {
                    e.stopPropagation()
                  }}
                  hoverEffect={false}
                  target={'_blank'}
                >
                  <p className="text-[14px]">Video Response</p>
                </StandardButton>
                <StandardButton
                  className={`gradient-2 w-fit font-[14px] mr-4`}
                  link={finalist?.writtenUrl}
                  onClick={(e: any) => {
                    e.stopPropagation()
                  }}
                  hoverEffect={false}
                  target={'_blank'}
                >
                  <p className="text-[14px]">Written Response</p>
                </StandardButton>
              </div>
            </div>
          </div>
          {isVotingPeriod &&
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
        </div>
      </div>
    )
  }
)
FinalistCardContent.displayName = 'FinalistCardContent'

export default function FinalistCard({
  finalist,
  distribution,
  handleDistributionChange,
  userHasVotingPower,
  isVotingPeriod,
}: FinalistCardProps) {
  const account = useActiveAccount()
  const address = account?.address

  const { selectedChain } = useContext(ChainContextV5)
  const ineligible =
    address && finalist && finalist.address.toLowerCase() == address.toLowerCase()

  return (
    <>
      {isVotingPeriod ? (
        <FinalistCardContent
          finalist={finalist}
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
