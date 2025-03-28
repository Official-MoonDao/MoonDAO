import Link from 'next/link'
import JuiceboxLogoWhite from '../assets/JuiceboxLogoWhite'
import TimestampVersion from '../layout/TimestampVersion'

export type MissionActivityEventProps = {
  header?: string
  subject?: React.ReactNode
  extra?: React.ReactNode
  event?: any
  withProjectLink?: boolean
  pv?: string
}

export default function MissionActivityEvent({
  header,
  subject,
  extra,
  event,
  withProjectLink,
  pv,
}: MissionActivityEventProps) {
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
      <div className="mt-2 opacity-60">{extra}</div>
      <hr className="border-1 mt-2 opacity-60" />
    </div>
  )
}
