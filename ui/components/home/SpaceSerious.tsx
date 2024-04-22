import Image from 'next/image'
import Link from 'next/link'
import SlideButton from './SlideButton'

function Point({ children }: any) {
  return (
    <div className="w-full flex gap-2 items-center">
      <div className="px-[6px] flex items-center justify-center rounded-full text-[#222949] bg-white text-center font-bold shadow-md shadow-white">
        ✓
      </div>
      <p>{children}</p>
    </div>
  )
}

export default function SpaceSerious() {
  return (
    <div className="flex flex-col h-[1800px] md:h-[1500px]">
      <h1 className="text-4xl font-GoodTimes">
        MOONDAO IS
        <br />
        SPACE{' '}
        <span className="bg-white text-black px-2 rounded-sm">SERIOUS</span>
      </h1>

      <div className="mt-12 flex flex-col gap-4">
        <Point>
          {`
Allocated $100,000+ (50+ ETH) to space R&D projects through our community governance, like open source time standards for PNT on the Moon (shortlisted by DARPA for a grant). Apply here`}
        </Point>
        <Point>{`Chartered an entire Zero Gravity flight for our community alongside Apollo 16 Astronaut Charlie Duke, Nicole Stott, and Doug Hurley.
‍Purchase your seat`}</Point>
        <Point>{`Developed a first-of-its-kind open-source DAO operating system to improve community governance, onboarding, and coordination.`}</Point>
        <Point>{`Established a constitution for self-governance, which will be sent to the surface of the Moon in 2024 with LifeShip.`}</Point>
        <Point>{`Sent the first crowdraised astronaut to space, through a democratically governed onchain election.
‍See the video`}</Point>
        <Point>{`Launched the Ticket To Space Sweepstakes to select an everyday person to go to space.`}</Point>
      </div>

      <div className="mt-8">
        <Image
          src="/home/MoonDAO-New-Shepard.jpg"
          width={800}
          height={800}
          alt=""
        />
      </div>

      <div className="w-full mt-12 flex flex-col gap-8 md:flex-row md:gap-2">
        <Image
          className="w-[150px] h-[150px]"
          src="/home/MoonDAO-logo-community.png"
          width={150}
          height={150}
          alt=""
        />

        <div className="flex flex-col">
          <h2 className="text-xl font-GoodTimes">
            <span className="bg-white text-black px-2 rounded-sm">
              OUR FUTURE OBJECTIVE:
            </span>
            <br />
            {`ACCELERATE THE CREATION OF`}
            <br />
            {`A LUNAR SETTLEMENT`}
          </h2>
          <p>{`Discover MoonDAO's three-part master plan which outlines what we've done, what we're doing, what we will do, and how we'll get there!`}</p>
        </div>
      </div>
      <Link
        href="https://docs.moondao.com/The-Master-Plan"
        target="_blank"
        rel="no refferer"
        passHref
      >
        <SlideButton className="mt-4">READ THE MASTER PLAN</SlideButton>
      </Link>

      <div className="mt-24 w-full max-w-[1000px] flex flex-col gap-4">
        <h1 className="font-GoodTimes text-center w-full text-2xl">
          {"MOONDAO'S PARTNERS"}
        </h1>
        <div className="w-full grid grid-cols-2 md:grid-cols-6 gap-8 items-center justify-items-center">
          <Image
            className="w-[75px] h-[75px]"
            src="/home/blue-origin-logo.png"
            width={100}
            height={100}
            alt=""
          />
          <Image
            className="w-[75px] h-[75px]"
            src="/home/lifeship-logo.svg"
            width={100}
            height={100}
            alt=""
          />
          <Image
            className="w-[75px] h-[75px]"
            src="/home/sfbw-logo.png"
            width={100}
            height={100}
            alt=""
          />
          <Image
            className="w-[75px] h-[75px]"
            src="/home/cryodao-logo.svg"
            width={100}
            height={100}
            alt=""
          />
          <Image
            className="w-[75px] h-[75px]"
            src="/home/desci-labs-logo.svg"
            width={100}
            height={100}
            alt=""
          />
          <Image
            className="w-[75px] h-[45px]"
            src="/home/im-logo.png"
            width={100}
            height={100}
            alt=""
          />
        </div>
      </div>
    </div>
  )
}
