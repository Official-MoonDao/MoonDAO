import {
  ArrowUpRightIcon,
  GlobeAmericasIcon,
  LockClosedIcon,
  PlusIcon,
  UserIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Frame from '@/components/layout/Frame'
import Action from '@/components/subscription/Action'
import { TwitterIcon } from '../assets'
import SlidingCardMenu from '../layout/SlidingCardMenu'

type CitizenActionsProps = {
  nft: any
  address: string
  incompleteProfile?: boolean
  isTeamMember?: boolean
  mooneyBalance?: number
  vmooneyBalance?: number
  setCitizenMetadataModalEnabled: Function
}

export default function CitizenActions({
  nft,
  address,
  incompleteProfile,
  isTeamMember,
  mooneyBalance,
  vmooneyBalance,
  setCitizenMetadataModalEnabled,
}: CitizenActionsProps) {
  const router = useRouter()
  const { getAccessToken } = usePrivy()

  const [hasMooney, setHasMooney] = useState<boolean>(false)
  const [hasVmooney, setHasVmooney] = useState<boolean>(false)
  // Add these new state variables
  const [isCheckingRoles, setIsCheckingRoles] = useState<boolean>(false)
  const [roleCheckResult, setRoleCheckResult] = useState<string | null>(null)
  const [citizenRoleStatus, setCitizenRoleStatus] = useState<string | null>(
    null
  )
  const [voterRoleStatus, setVoterRoleStatus] = useState<string | null>(null)

  useEffect(() => {
    if (mooneyBalance && mooneyBalance > 0) setHasMooney(true)
    if (vmooneyBalance && vmooneyBalance > 0) setHasVmooney(true)
  }, [mooneyBalance, vmooneyBalance])

  const checkDiscordRoles = async () => {
    setIsCheckingRoles(true)
    setRoleCheckResult(null)
    setCitizenRoleStatus(null)
    setVoterRoleStatus(null)

    try {
      const accessToken = await getAccessToken()

      // Check both citizen and voter roles in parallel
      const [citizenResponse, voterResponse] = await Promise.allSettled([
        fetch('/api/discord/@citizen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        }),
        fetch('/api/discord/@voter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        }),
      ])

      let citizenSuccess = false
      let voterSuccess = false

      // Process citizen role result
      if (citizenResponse.status === 'fulfilled' && citizenResponse.value.ok) {
        setCitizenRoleStatus('Citizen')
        citizenSuccess = true
      } else {
        setCitizenRoleStatus('Citizen (Not Eligible)')
      }

      // Process voter role result
      if (voterResponse.status === 'fulfilled' && voterResponse.value.ok) {
        setVoterRoleStatus('Voter')
        voterSuccess = true
      } else {
        setVoterRoleStatus('Voter (Not Eligible)')
      }

      // Set clean result message
      if (citizenSuccess && voterSuccess) {
        setRoleCheckResult('All Discord roles assigned!')
      } else if (citizenSuccess || voterSuccess) {
        setRoleCheckResult('Some roles assigned')
      } else {
        setRoleCheckResult('Check requirements and try again')
      }
    } catch (error) {
      setRoleCheckResult('Error checking roles. Please try again.')
      console.error('Error checking Discord roles:', error)
    } finally {
      setIsCheckingRoles(false)
    }
  }

  return (
    <div id="citizen-actions-container" className="py-5 md:px-5 md:py-0 z-30">
      {address.toLowerCase() === nft?.owner?.toLowerCase() && (
        <>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pr-12">
            <div className="flex gap-5 opacity-[50%]">
              <h2 className="header font-GoodTimes">Next Steps</h2>
            </div>
          </div>
          <div className="px-5 pt-5 md:px-0 md:pt-0">
            <Frame
              noPadding
              marginBottom="0px"
              bottomRight="2vmax"
              topRight="2vmax"
              topLeft="10px"
              bottomLeft="2vmax"
            >
              <SlidingCardMenu>
                <div className="flex gap-5">
                  {incompleteProfile && (
                    <Action
                      title="Complete Profile"
                      description="Complete your profile by adding a bio, social links, or your location."
                      icon={<UserIcon height={30} width={30} />}
                      onClick={() => setCitizenMetadataModalEnabled(true)}
                    />
                  )}
                  {!hasMooney && !hasVmooney && (
                    <Action
                      title="Get Mooney"
                      description="$MOONEY is our governance token, swap directly from within the website."
                      icon={
                        <Image
                          src="/assets/icon-job.svg"
                          alt="Browse open jobs"
                          height={30}
                          width={30}
                        />
                      }
                      onClick={() => router.push('/get-mooney')}
                    />
                  )}
                  {hasMooney && !hasVmooney && (
                    <Action
                      title="Lock to Vote"
                      description="Lock your MOONEY to aquire voting power and vote on proposals."
                      icon={<LockClosedIcon height={30} width={30} />}
                      onClick={() => router.push('/lock')}
                    />
                  )}
                  <Action
                    title="Share on X"
                    description="Share your citizen profile on X!"
                    icon={
                      <div className="scale-[1.15] flex flex-col mt-[7px]">
                        <TwitterIcon />
                      </div>
                    }
                    onClick={() => {
                      window.open(
                        `https://x.com/intent/tweet?url=${window.location.href}&text=I%20just%20became%20a%20Citizen%20of%20the%20Space%20Acceleration%20Network%20%40OfficialMoonDAO`
                      )
                    }}
                  />
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
                    onClick={() => router.push('/proposals')}
                  />
                  <Action
                    title="Submit Contribution"
                    description="Get rewarded for mission-aligned work towards a lunar settlement."
                    icon={
                      <Image
                        src="/assets/icon-submit.svg"
                        alt="Submit contribution"
                        height={30}
                        width={30}
                      />
                    }
                    onClick={() => router.push('/contributions')}
                  />
                  <Action
                    title="Explore Map"
                    description="Connect with fellow members of the Network both locally and globally."
                    icon={<GlobeAmericasIcon height={40} width={40} />}
                    onClick={() => router.push('/map')}
                  />
                  <Action
                    title="Unlock Roles"
                    description="Join Guild.xyz by connecting your wallet and Discord to unlock new roles."
                    icon={<ArrowUpRightIcon height={30} width={30} />}
                    onClick={() => window.open('https://guild.xyz/moondao')}
                  />
                  <Action
                    title="Check Roles"
                    description={
                      isCheckingRoles ? (
                        'Checking eligibility...'
                      ) : roleCheckResult ? (
                        <div className="space-y-2">
                          <div
                            className={`font-medium ${
                              roleCheckResult === 'All Discord roles assigned!'
                                ? 'text-green-400'
                                : roleCheckResult === 'Some roles assigned'
                                ? 'text-yellow-400'
                                : 'text-red-400'
                            }`}
                          >
                            {roleCheckResult}
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {citizenRoleStatus && (
                              <div
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                                  citizenRoleStatus.includes('Not Eligible')
                                    ? 'bg-red-900/20 border-red-500/30 text-red-400'
                                    : 'bg-green-900/20 border-green-500/30 text-green-400'
                                }`}
                              >
                                <span className="text-sm font-medium">
                                  {citizenRoleStatus}
                                </span>
                              </div>
                            )}
                            {voterRoleStatus && (
                              <div
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                                  voterRoleStatus.includes('Not Eligible')
                                    ? 'bg-red-900/20 border-red-500/30 text-red-400'
                                    : 'bg-green-900/20 border-green-500/30 text-green-400'
                                }`}
                              >
                                <span className="text-sm font-medium">
                                  {voterRoleStatus}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        'Verify your Citizen NFT and vMOONEY to get Discord roles automatically.'
                      )
                    }
                    icon={
                      isCheckingRoles ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      ) : (
                        <CheckCircleIcon height={30} width={30} />
                      )
                    }
                    onClick={isCheckingRoles ? undefined : checkDiscordRoles}
                    disabled={isCheckingRoles}
                  />

                  {!isTeamMember && (
                    <Action
                      title="Create a Team"
                      description="Join a team or create your own to work together on accelerating space."
                      icon={<PlusIcon height={30} width={30} />}
                      onClick={() => router.push('/team')}
                    />
                  )}
                </div>
              </SlidingCardMenu>
            </Frame>
          </div>
        </>
      )}
    </div>
  )
}
