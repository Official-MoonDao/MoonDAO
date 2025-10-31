import { NativeTokenValue, useSuckers } from 'juice-sdk-react'
import { useMemo, useState } from 'react'
import { transformEventData } from '@/lib/juicebox/transformEventData'
import useOmnichainSubgraphProjectEvents from '@/lib/juicebox/useOmnichainSubgraphProjectEvents'
import { tokenSymbolText } from '@/lib/utils/strings'
import Selector from '../layout/Selector'
import MissionActivityEvent from './MissionActivityEvent'

export default function MissionActivityList({
  selectedChain,
  tokenSymbol,
  projectId,
  citizens,
}: any) {
  const [filter, setFilter] = useState<'all' | 'payEvent' | 'mintTokensEvent'>(
    'all'
  )

  const { data: suckers, refetch } = useSuckers()

  const {
    data: projectEventsQueryResult,
    isLoading: loadingEvents,
    fetchNextPage,
  } = useOmnichainSubgraphProjectEvents({
    filter: filter === 'all' ? undefined : filter,
    sucker: suckers?.find((s: any) => s.peerChainId === selectedChain.id),
    projectId,
  })

  const projectEvents = useMemo(
    () =>
      projectEventsQueryResult?.pages
        .flatMap((page) => page.data.activityEvents.items)
        .map(transformEventData)
        .filter((event) => !!event)
        .map((e) => translateEventDataToPresenter(e, tokenSymbol, citizens)) ??
      [],
    [projectEventsQueryResult?.pages]
  )

  return (
    <div>
      <div className="flex justify-end items-center gap-4">
        <Selector
          value={filter}
          onChange={(value) => {
            setFilter(value as 'all' | 'payEvent' | 'mintTokensEvent')
          }}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Contributions', value: 'payEvent' },
            { label: 'Tokens', value: 'mintTokensEvent' },
          ]}
        />
      </div>
      <div className="flex flex-col gap-4">
        {projectEvents.map((event, i) => (
          <MissionActivityEvent
            key={event?.event.id + i}
            header={event?.header}
            subject={event?.subject}
            extra={event?.extra}
            address={event?.address}
            name={event?.name}
            event={event?.event}
          />
        ))}
        <button className="text-lg text-left" onClick={() => fetchNextPage()}>
          Load more
        </button>
      </div>
    </div>
  )
}

function RichNote({ note }: { note: string }) {
  return <div className="text-sm break-words">{note}</div>
}

function translateEventDataToPresenter(
  event: any,
  tokenSymbol: string | undefined,
  citizens: any[]
) {
  switch (event.type) {
    case 'payEvent':
      return {
        event,
        header: 'Paid',
        subject: (
          <span className="font-heading text-lg">
            <NativeTokenValue decimals={8} wei={event.amount.value} />
          </span>
        ),
        extra: null,
      }
    case 'addToBalanceEvent':
      return {
        event,
        header: 'Added to balance',
        subject: (
          <span className="font-heading text-lg">
            <NativeTokenValue decimals={8} wei={event.amount.value} />
          </span>
        ),
        extra: null,
      }
    case 'mintTokensEvent':
      const name = citizens.find(
        (citizen) =>
          citizen.owner.toLowerCase() == event.beneficiary.toLowerCase()
      )?.name
      return {
        event,
        header: 'Minted tokens',
        subject: (
          <span className="font-heading text-lg">To: {event.beneficiary}</span>
        ),
        extra: null,
        address: event.beneficiary,
        name: name,
      }

    case 'deployErc20Event':
      return {
        event,
        header: 'Deployed ERC20',
        subject: <span className="font-heading text-lg">{event.symbol}</span>,
        extra: null,
      }
    case 'projectCreateEvent':
      return {
        event,
        header: 'Created',
        subject: 'Project created 🎉',
        extra: null,
      }

    case 'burnEvent':
      return {
        event,
        header: 'Burned',
        subject: (
          <span className="font-heading text-lg">
            {Number(event.amount.toFloat())}{' '}
            {tokenSymbolText({
              tokenSymbol,
              plural: event.amount.toFloat() > 1,
            })}
          </span>
        ),
        extra: null,
      }
  }
}
