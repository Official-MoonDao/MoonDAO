import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import SubPoint from '../layout/SubPoint'

export default function MissionTokenNotice() {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-black/20 border border-white/10 rounded-lg overflow-hidden">
      <div
        className="relative p-4 cursor-pointer hover:bg-black/30 transition-all duration-200"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <p className="text-white font-medium">
              {expanded
                ? 'Important Notice'
                : 'Please read this notice before continuing'}
            </p>
          </div>
          <ChevronDownIcon
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      <div
        className={`${
          expanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden transition-all duration-300 ease-in-out`}
      >
        <div className="px-4 pb-4 space-y-4 text-sm text-gray-300 border-t border-white/5">
          <div className="pt-4">
            <p className="leading-relaxed">
              By contributing through the MoonDAO Launchpad, you acknowledge
              that MoonDAO is not responsible for the legality, security, or
              management of any mission, fundraising campaign, or token launch.
              Funds are fully controlled by the campaign creators via their
              team's multisig wallet, and MoonDAO has no access to recover,
              return, or intervene in case of loss, fraud, or mismanagement.
            </p>
          </div>

          <div className="space-y-3">
            <p className="leading-relaxed">
              Any tokens issued are solely managed by the campaign team, which
              is responsible for their legal compliance, distribution, and
              promotion. MoonDAO does not facilitate token sales or guarantee
              liquidity.
            </p>

            <p className="leading-relaxed">
              When you make a contribution to a Launchpad project, or otherwise
              purchase or acquire any Launchpad tokens, whether directly, via an
              exchange, or otherwise, you represent, warrant and agree as
              follows:
            </p>
          </div>

          <div className="space-y-2 pl-4 border-l-2 border-yellow-500/30">
            <SubPoint point="You agree that, even if profit does arise from your contribution or from the acquisition of tokens, you nevertheless have absolutely no expectation of profit from any contribution or acquisition of Tokens, and you further agree that any statements made by you or others stating otherwise are superseded by this Agreement;" />
            <SubPoint point="For the avoidance of doubt, you agree that any and all statements made by you or the MoonDAO Community outside of this Agreement, especially with regard to profit, are fully superseded by this Agreement;" />
            <SubPoint point="You have an adequate understanding of the functionality and characteristics of Launchpad Tokens and the differences between these and other currencies;" />
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-yellow-400 text-sm leading-relaxed">
              By proceeding, you accept all associated risks, including
              regulatory uncertainty, market volatility, and potential legal
              liabilities. Contributors should conduct their own due diligence
              before participating.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
