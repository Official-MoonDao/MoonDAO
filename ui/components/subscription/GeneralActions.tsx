import Image from 'next/image'
import CoordinapeLogoWhite from '../assets/CoordinapeLogoWhite'
import JuiceboxLogoWhite from '../assets/JuiceboxLogoWhite'
import LlamaPayIcon from '../assets/LlamaPayIcon'
import Card from './Card'

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
    <Card
      className="flex flex-col justify-between p-8 w-full hover:scale-105 duration-300 bg-[#e7e5e7]"
      onClick={() => window.open(href)}
    >
      <div className="h-[50px]">{logo}</div>
      <p className="mt-2 h-full">{description}</p>
      <div className="mt-8 flex gap-4">
        {points.map((p, i) => (
          <p key={p + i} className="py-2 px-4 bg-[#ffffff25] rounded-full">
            {p}
          </p>
        ))}
      </div>
    </Card>
  )
}

export default function GeneralActions() {
  return (
    <div className="flex flex-col gap-4">
      <p className="p-4 text-2xl">General Actions</p>
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8">
        <GeneralAction
          logo={<CoordinapeLogoWhite />}
          description={`Coordinape is a collaborative platform that enables teams to allocate tokens (GIVE) to recognize each other's contributions.`}
          points={['Give', 'Rewards']}
          href="https://coordinape.com/"
        />
        <GeneralAction
          logo={<JuiceboxLogoWhite />}
          description={`Join thousands of projects using Juicebox to fund, operate, and scale their ideas & communities transparently on Ethereum.
`}
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
      {/* 2nd row of general actions */}
      <div className="mt-2 lg:mr-16 flex flex-col md:flex-row gap-8"></div>
    </div>
  )
}
