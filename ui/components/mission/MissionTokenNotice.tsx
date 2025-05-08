import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import SubPoint from '../layout/SubPoint'

export default function MissionTokenNotice() {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      className="relative p-4 bg-moon-indigo rounded-xl w-full cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <button className="absolute right-4 top-4 flex items-center gap-2">
        <ChevronDownIcon
          className={`w-6 h-6 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {!expanded && <p>{`Please read this notice before continuing.`}</p>}
      <div
        className={`${
          expanded ? 'block' : 'hidden'
        } overflow-hidden transition-all duration-300`}
      >
        <p>{`By contributing through the MoonDAO Launchpad, you acknowledge that MoonDAO is not responsible for the legality, security, or management of any mission, fundraising campaign, or token launch. Funds are fully controlled by the campaign creators via their team’s multisig wallet, and MoonDAO has no access to recover, return, or intervene in case of loss, fraud, or mismanagement.`}</p>
        <br />
        <p>
          {`Any tokens issued are solely managed by the campaign team, which is responsible for their legal compliance, distribution, and promotion. MoonDAO does not facilitate token sales or guarantee liquidity.`}
          <br />
          <br />
          {`When you make a contribution to a Launchpad project, or otherwise purchase or acquire any Launchpad tokens, whether directly, via an exchange, or otherwise, you represent, warrant and agree as follows:`}
        </p>
        <SubPoint point="You agree that, even if profit does arise from your contribution or from the acquisition of tokens, you nevertheless have absolutely no expectation of profit from any contribution or acquisition of Tokens, and you further agree that any statements made by you or others stating otherwise are superseded by this Agreement;" />
        <SubPoint point="For the avoidance of doubt, you agree that any and all statements made by you or the MoonDAO Community outside of this Agreement, especially with regard to profit, are fully superseded by this Agreement;" />
        <SubPoint point="You have an adequate understanding of the functionality and characteristics of Launchpad Tokens and the differences between these and other currencies;" />
        <br />
        <p>
          {
            'By proceeding, you accept all associated risks, including regulatory uncertainty, market volatility, and potential legal liabilities. Contributors should conduct their own due diligence before participating.'
          }
        </p>
      </div>
    </div>
  )
}
