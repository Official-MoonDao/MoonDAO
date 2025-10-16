import Link from 'next/link'
import { useContext } from 'react'
import { useCitizen } from '@/lib/citizen/useCitizen'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useENS } from '@/lib/utils/hooks/useENS'
import JuiceboxLogoWhite from '../assets/JuiceboxLogoWhite'
import TimestampVersion from '../layout/TimestampVersion'

export type MissionActivityEventProps = {
  header?: string
  subject?: React.ReactNode
  extra?: React.ReactNode
  address?: string
  event?: any
  withProjectLink?: boolean
  pv?: string
}

export default function MissionActivityEvent({
  header,
  subject,
  extra,
  address,
  event,
  withProjectLink,
  pv,
}: MissionActivityEventProps) {
  const { data: ens } = useENS(address)
  const { selectedChain } = useContext(ChainContextV5)
  const citizen = useCitizen(selectedChain, undefined, address)
  return (
    <div className="border-1 border-light-warm">
      <div className="text-xs capitalize text-grey-500 opacity-60">
        {header}
        {withProjectLink && (
          <span className="ml-1">
            <Link href={``} passHref>
              <JuiceboxLogoWhite />
            </Link>
          </span>
        )}
      </div>
      <TimestampVersion timestamp={event.timestamp} />
      <div className="text-sm">{subject}</div>
      <div className="mt-2 opacity-60">
        {citizen ? citizen.metadata.name : ens ? ens.name : ''}
      </div>
      <hr className="border-1 mt-2 opacity-60" />
    </div>
  )
}
