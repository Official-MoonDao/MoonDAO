import Image from 'next/image'
import CoordinapeLogoWhite from '../assets/CoordinapeLogoWhite'
import JuiceboxLogoWhite from '../assets/JuiceboxLogoWhite'
import LlamaPayIcon from '../assets/LlamaPayIcon'

type GeneralActionProps = {
  logo: any
  description: string
  points: string[]
  href: string
}

function GeneralAction({
  logo,
  description,
  points,
  href,
}: GeneralActionProps) {
  return (
    <button
      className="w-full hover:scale-105 ease-in-out duration-300 group"
      onClick={() => window.open(href)}
    >
      <div className="bg-slate-600/20 backdrop-blur-sm border border-slate-500/50 rounded-xl p-5 h-full hover:bg-slate-600/30 transition-colors">
        <div className="h-[75px] flex items-center justify-start">{logo}</div>
        <p className="mt-4 h-[120px] text-start text-slate-300 text-sm leading-relaxed">{description}</p>
        <div className="mt-6 flex gap-2 flex-wrap">
          {points.map((p, i) => (
            <span key={p + i} className="py-1 px-3 bg-slate-700/50 text-slate-200 rounded-full text-xs">
              {p}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}

export default function GeneralActions() {
  return (
    <div className="p-6">
      <div className="flex gap-5 mb-6">
        <Image
          src={'/assets/icon-action.svg'}
          alt="On-chain tools icon"
          width={30}
          height={30}
          className="opacity-70"
        />
        <h2 className="font-GoodTimes text-2xl text-white">On-Chain Tools</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <GeneralAction
          logo={<CoordinapeLogoWhite />}
          description={`Coordinape is a collaborative platform that enables teams to allocate tokens (GIVE) to recognize each other's contributions.`}
          points={['Give', 'Rewards']}
          href="https://coordinape.com/"
        />
        <GeneralAction
          logo={<JuiceboxLogoWhite />}
          description={`Join thousands of projects using Juicebox to fund, operate, and scale their ideas & communities transparently on Ethereum.`}
          points={['Crowdfunding', 'Payout']}
          href="https://juicebox.money/"
        />
        <GeneralAction
          logo={
            <Image
              src="/logos/gitcoin-passport-logo.png"
              width={150}
              height={50}
              alt=""
            />
          }
          description={`Gitcoin Passport is an identity verification platform enabling users to collect verifiable credentials ("Stamps") from Web2 and Web3 authenticators, building a personal verified identity ledger for organizations to assess.`}
          points={['Reputation', 'Identification']}
          href="https://passport.gitcoin.co/"
        />
        <GeneralAction
          logo={<LlamaPayIcon />}
          description="LlamaPay is a multi-chain protocol that allows you to automate transactions and stream them by the second. Recipients can withdraw these funds at any time, eliminating the need for manual reoccuring payment transactions."
          points={['Streaming', 'Payments']}
          href="https://llamapay.io/"
        />
      </div>
    </div>
  )
}
