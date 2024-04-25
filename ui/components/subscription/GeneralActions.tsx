import Image from 'next/image'
import CoordinapeLogoWhite from '../assets/CoordinapeLogoWhite'
import JuiceboxLogoWhite from '../assets/JuiceboxLogoWhite'
import Card from './Card'

type GeneralActionProps = {
  logo: any
  description: string
  points: string[]
}

function GeneralAction({ logo, description, points }: GeneralActionProps) {
  return (
    <Card
      className="flex flex-col justify-between p-8 w-full lg:w-1/3 hover:scale-105 duration-300 bg-[#e7e5e7]"
      onClick={() => window.open('https://coordinape.com/')}
    >
      {logo}
      <p className="mt-2">{description}</p>
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
      <div className="flex flex-col lg:flex-row gap-8">
        <GeneralAction
          logo={<CoordinapeLogoWhite />}
          description={`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}
          points={['Give', 'Rewards']}
        />
        <GeneralAction
          logo={<JuiceboxLogoWhite />}
          description={`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}
          points={['Crowdfunding', 'Payout']}
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
          description={`Gorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.`}
          points={['Reputation', 'Privacy']}
        />
      </div>
      {/* 2nd row of general actions */}
      <div className="mt-2 lg:mr-16 flex flex-col md:flex-row gap-8"></div>
    </div>
  )
}
