import Image from 'next/image'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import TeamMembers from '@/components/subscription/TeamMembers'
import MissionSocialLinks from './MissionSocialLinks'

type MissionTeamSectionProps = {
  teamSocials: {
    communications?: string
    twitter?: string
    website?: string
    discord?: string
  }
  teamHats: any[]
  hatsContract: any
  citizenContract: any
}

export default function MissionTeamSection({
  teamSocials,
  teamHats,
  hatsContract,
  citizenContract,
}: MissionTeamSectionProps) {
  return (
    <div className="w-full px-[5vw] flex justify-center">
      <div className="w-full bg-gradient-to-r from-darkest-cool to-dark-cool max-w-[1200px] rounded-[5vw] md:rounded-[2vw] px-0 pb-[5vw] md:pb-[2vw]">
        <div className="ml-[5vw] md:ml-[2vw] mt-[2vw] flex justify-between w-full gap-2 text-light-cool">
          <div className="flex items-center gap-2 w-full">
            <Image
              src={'/assets/icon-star-blue.svg'}
              alt="Job icon"
              width={30}
              height={30}
            />
            <h2 className="text-2xl 2xl:text-4xl font-GoodTimes text-moon-indigo">
              Meet the Team
            </h2>
          </div>
          <div className="flex justify-end gap-2 w-full text-white mr-[5vw]">
            <MissionSocialLinks socials={teamSocials} />
          </div>
        </div>
        <SlidingCardMenu>
          <div className="flex gap-4"></div>
          {teamHats?.[0]?.id && (
            <TeamMembers
              hats={teamHats}
              hatsContract={hatsContract}
              citizenContract={citizenContract}
            />
          )}
        </SlidingCardMenu>
      </div>
    </div>
  )
}

