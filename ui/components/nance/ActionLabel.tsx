import { Action, RequestBudget } from '@nance/nance-sdk'
import { classNames } from '@/lib/utils/tailwind'
import { AddressLink } from './AddressLink'
import { TokensOfProposal } from './RequestingTokensOfProposal'

// TODO finish this, or using requestingTokensOfProposal
export default function ActionLabel({ action }: { action: Action }) {
  const comment = '// Unrecognized action, pls check'

  if (action.type === 'Request Budget') {
    const requestBudget = action.payload as RequestBudget

    return (
      <div className="ml-2 flex w-full space-x-2 break-words">
        <span className="inline-flex h-min w-min items-center rounded-md bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800">
          Request Budget
        </span>

        <div className="flex flex-col">
          <p className="line-clamp-5">
            <span>{'Team: '}</span>
            {requestBudget.projectTeam.map((member) => (
              <span
                key={member.discordUserId + member.payoutAddress}
                className={classNames(
                  'mr-1',
                  member.isRocketeer && 'font-semibold'
                )}
              >
                <AddressLink address={member.payoutAddress} />
              </span>
            ))}
          </p>
          <p className="line-clamp-5">
            <span>{'Multisig: '}</span>
            {requestBudget.multisigTeam.map((member) => (
              <span
                key={member.discordUserId + member.address}
                className="mr-1"
              >
                <AddressLink address={member.address} />
              </span>
            ))}
          </p>
          <div className="font-semibold italic text-emerald-600">
            Tokens: <TokensOfProposal actions={[action]} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-gray-400">{comment}</p>
      <p>{JSON.stringify(action)}</p>
    </div>
  )
}
