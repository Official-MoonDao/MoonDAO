import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import SubPoint from '../layout/SubPoint'

export default function MissionTokenNotice() {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-black/20 border border-white/10 rounded-lg overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="relative p-4 cursor-pointer hover:bg-black/30 transition-all duration-200"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shrink-0 mt-2" />
            <div className="min-w-0">
              {expanded ? (
                <p className="text-sm text-gray-300 font-medium leading-relaxed">Important notice</p>
              ) : (
                <>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    <span className="font-medium">Important note: </span>
                    Funds are held and controlled by the mission team, not MoonDAO. Launchpad
                    tokens are not investments; you accept regulatory, legal, and market risk.
                  </p>
                  <p className="text-sm text-gray-300 leading-relaxed mt-2.5">
                    Tap or click to expand the full notice
                  </p>
                </>
              )}
            </div>
          </div>
          <ChevronDownIcon
            className={`w-5 h-5 text-gray-400 shrink-0 mt-1 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </div>
      </div>

      <div
        className={`${
          expanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden transition-all duration-300 ease-in-out`}
      >
        <div className="px-4 pb-4 space-y-4 border-t border-white/5">
          <div className="pt-4">
            <p className="text-sm text-gray-300 leading-relaxed">
              By contributing through the MoonDAO Launchpad, you acknowledge
              that MoonDAO is not responsible for the legality, security, or
              management of any mission, fundraising campaign, or token launch.
              Funds are fully controlled by the campaign creators via their
              team's multisig wallet, and MoonDAO has no access to recover,
              return, or intervene in case of loss, fraud, or mismanagement.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-300 leading-relaxed">
              Any tokens issued are solely managed by the campaign team, which
              is responsible for their legal compliance, distribution, and
              promotion.
            </p>

            <p className="text-sm text-gray-300 leading-relaxed">
              When you make a contribution to a Launchpad project, or otherwise
              purchase or acquire any Launchpad tokens, whether directly, via an
              exchange, or otherwise, you represent, warrant and agree as
              follows:
            </p>
          </div>

          <div className="space-y-2 pl-4 border-l-2 border-yellow-500/30">
            <SubPoint
              className="text-sm text-gray-300 leading-relaxed"
              point="You agree that, even if profit does arise from your contribution or from the acquisition of tokens, you nevertheless have absolutely no expectation of profit from any contribution or acquisition of Tokens, and you further agree that any statements made by you or others stating otherwise are superseded by this Agreement;"
            />
            <SubPoint
              className="text-sm text-gray-300 leading-relaxed"
              point="For the avoidance of doubt, you agree that any and all statements made by you or the MoonDAO Community outside of this Agreement, especially with regard to profit, are fully superseded by this Agreement;"
            />
            <SubPoint
              className="text-sm text-gray-300 leading-relaxed"
              point="You have an adequate understanding of the functionality and characteristics of Launchpad Tokens and the differences between these and other currencies;"
            />
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-sm text-gray-300 leading-relaxed">
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
