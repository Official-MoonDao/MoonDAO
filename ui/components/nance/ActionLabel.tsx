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
      <div className="ml-2 flex w-full flex-col space-y-2 break-words">
        <div className="flex items-start space-x-2">
          <span className="inline-flex h-min w-min shrink-0 items-center rounded-md bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800">
            Request Budget
          </span>

          <div className="flex flex-col flex-grow space-y-2">
            <div className="flex space-x-4">
              <div className="flex-1">
                <span className="underline">{'Team '}</span>
                {requestBudget.projectTeam.map((member) => (
                  <div
                    key={member.discordUserId}
                    className={classNames(
                      'ml-2',
                      'whitespace-nowrap',
                      member.isRocketeer && 'font-semibold'
                    )}
                  >
                    @{member.discordUsername}
                  </div>
                ))}
              </div>
              <div className="flex-1">
                <span className="underline">{'Multisig'}</span>
                {requestBudget.multisigTeam.map((member) => (
                  <div
                    key={member.discordUserId + member.address}
                    className="ml-2"
                  >
                    <AddressLink address={member.address} />
                  </div>
                ))}
              </div>
            </div>

            <div className="font-semibold italic text-emerald-600">
              Tokens: <TokensOfProposal actions={[action]} />
            </div>
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
