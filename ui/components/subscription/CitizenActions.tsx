import { UserIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useRouter } from 'next/router'
import Frame from '@/components/layout/Frame'
import Action from '@/components/subscription/Action'

type CitizenActionsProps = {
  address?: string
  nft?: any
  incompleteProfile?: boolean
}

export default function CitizenActions({
  address,
  nft,
  incompleteProfile,
}: CitizenActionsProps) {
  const router = useRouter()
  return (
    <div id="team-actions-container" className=" z-30">
      {address === nft?.owner ? (
        <div id="team-actions-container" className="px-5 pt-5 md:px-0 md:pt-0">
          <Frame
            noPadding
            marginBottom="0px"
            bottomRight="2vmax"
            topRight="2vmax"
            topLeft="10px"
            bottomLeft="2vmax"
          >
            <div
              className={`mt-2 mb-5 grid grid-cols-1 lg:grid-cols-3 ${
                incompleteProfile && '2xl:grid-cols-4'
              } gap-4 h-full`}
            >
              {!incompleteProfile && (
                <Action
                  title="Complete Profile"
                  description="Complete your profile by adding a description, links, or your location."
                  icon={<UserIcon height={30} width={30} />}
                  onClick={() => {}}
                />
              )}
              <Action
                title="Create Project"
                description="Submit a proposal to secure funding for your space project."
                icon={
                  <Image
                    src="/assets/icon-project.svg"
                    alt="Submit a proposal"
                    height={30}
                    width={30}
                  />
                }
                onClick={() => router.push('/propose')}
              />
              <Action
                title="Browse Jobs"
                description="Browse job openings, contracting opportunities, and bounties."
                icon={
                  <Image
                    src="/assets/icon-job.svg"
                    alt="Browse open jobs"
                    height={30}
                    width={30}
                  />
                }
                onClick={() => router.push('/jobs')}
              />
              <Action
                title="Get Rewards"
                description="Get rewarded for mission-aligned work towards a lunar settlement."
                icon={
                  <Image
                    src="/assets/icon-submit.svg"
                    alt="Get rewards"
                    height={30}
                    width={30}
                  />
                }
                onClick={() =>
                  window.open(
                    'https://discord.com/channels/914720248140279868/1179874302447853659'
                  )
                }
              />
            </div>
          </Frame>
        </div>
      ) : (
        ''
      )}
    </div>
  )
}
