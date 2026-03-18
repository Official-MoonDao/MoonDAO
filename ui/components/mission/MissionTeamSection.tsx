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
    <div className="w-full px-5 md:px-8 lg:px-12 flex justify-center">
      <div className="w-full max-w-[1200px] bg-gradient-to-br from-slate-900/80 to-slate-800/40 border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-6 md:px-8 pt-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Image
                src={'/assets/icon-star-blue.svg'}
                alt="Team icon"
                width={18}
                height={18}
              />
            </div>
            <h2 className="text-xl md:text-2xl font-GoodTimes text-white">
              Meet the Team
            </h2>
          </div>
          <MissionSocialLinks socials={teamSocials} />
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

