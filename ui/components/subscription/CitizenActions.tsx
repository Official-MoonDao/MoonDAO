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
import { useEffect, useState, useCallback } from 'react'
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
  const { getAccessToken, linkDiscord, user } = usePrivy()

  const [hasMooney, setHasMooney] = useState<boolean>(false)
  const [hasVmooney, setHasVmooney] = useState<boolean>(false)
  // Add these new state variables
  const [isCheckingRoles, setIsCheckingRoles] = useState<boolean>(false)
  const [roleCheckResult, setRoleCheckResult] = useState<string | null>(null)
  const [citizenRoleStatus, setCitizenRoleStatus] = useState<string | null>(
    null
  )
  const [voterRoleStatus, setVoterRoleStatus] = useState<string | null>(null)
  const [citizenErrorMessage, setCitizenErrorMessage] = useState<string | null>(
    null
  )
  const [voterErrorMessage, setVoterErrorMessage] = useState<string | null>(
    null
  )
  const [hasDiscordLinked, setHasDiscordLinked] = useState<boolean>(false)

  useEffect(() => {
    if (mooneyBalance && mooneyBalance > 0) setHasMooney(true)
    if (vmooneyBalance && vmooneyBalance > 0) setHasVmooney(true)
  }, [mooneyBalance, vmooneyBalance])

  // Separate function for just checking roles (when Discord is already linked)
  const performRoleCheck = useCallback(async () => {
    setIsCheckingRoles(true)
    setRoleCheckResult(null)
    setCitizenRoleStatus(null)
    setVoterRoleStatus(null)
    setCitizenErrorMessage(null)
    setVoterErrorMessage(null)

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
        // Extract error message from citizen API response
        if (citizenResponse.status === 'fulfilled') {
          try {
            const errorData = await citizenResponse.value.json()
            setCitizenErrorMessage(errorData.error || 'Unknown error occurred')
          } catch {
            setCitizenErrorMessage('Failed to get error details')
          }
        } else {
          setCitizenErrorMessage('Network error - please try again')
        }
      }

      // Process voter role result
      if (voterResponse.status === 'fulfilled' && voterResponse.value.ok) {
        setVoterRoleStatus('Voter')
        voterSuccess = true
      } else {
        setVoterRoleStatus('Voter (Not Eligible)')
        // Extract error message from voter API response
        if (voterResponse.status === 'fulfilled') {
          try {
            const errorData = await voterResponse.value.json()
            setVoterErrorMessage(errorData.error || 'Unknown error occurred')
          } catch {
            setVoterErrorMessage('Failed to get error details')
          }
        } else {
          setVoterErrorMessage('Network error - please try again')
        }
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
      setCitizenErrorMessage('Network error - please try again')
      setVoterErrorMessage('Network error - please try again')
      console.error('Error checking Discord roles:', error)
    } finally {
      setIsCheckingRoles(false)
    }
  }, [getAccessToken])

  const checkDiscordRoles = useCallback(async () => {
    // If Discord is not linked, prompt user to link it
    if (!hasDiscordLinked) {
      try {
        setIsCheckingRoles(true)
        setRoleCheckResult(null)
        setCitizenErrorMessage(null)
        setVoterErrorMessage(null)
        // Set a flag in localStorage to track that we're attempting to link Discord
        localStorage.setItem('moondao_discord_linking_attempted', 'true')

        await linkDiscord()
        // After linking, the useEffect will automatically trigger role checking
        setRoleCheckResult('Discord linked! Checking roles...')
      } catch (error) {
        console.error('Error linking Discord:', error)
        setRoleCheckResult('Failed to link Discord. Please try again.')
        // Clear the flag if linking failed
        localStorage.removeItem('moondao_discord_linking_attempted')
      } finally {
        setIsCheckingRoles(false)
      }
      return
    }

    // If Discord is already linked, perform role check
    await performRoleCheck()
  }, [hasDiscordLinked, linkDiscord, performRoleCheck])

  useEffect(() => {
    // Check if user has Discord linked
    if (user?.linkedAccounts) {
      const hasDiscord = user.linkedAccounts.some(
        (acc: any) => acc.type === 'discord_oauth' || acc.type === 'discord'
      )

      // Check if we were attempting to link Discord
      const wasLinkingDiscord =
        localStorage.getItem('moondao_discord_linking_attempted') === 'true'

      // If Discord was just linked AND we were attempting to link it, automatically check roles
      if (!hasDiscordLinked && hasDiscord && wasLinkingDiscord) {
        // Clear the localStorage flag
        localStorage.removeItem('moondao_discord_linking_attempted')

        setTimeout(() => {
          const checkRolesElement =
            document.getElementById('check-roles-action')
          if (checkRolesElement) {
            checkRolesElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            })
          }
          // Automatically trigger role checking after Discord is linked
          setTimeout(() => {
            performRoleCheck()
          }, 1000) // Additional delay to ensure smooth scrolling completes
        }, 500) // Small delay to ensure the page has fully loaded
      }

      setHasDiscordLinked(hasDiscord)
    }
  }, [user?.linkedAccounts, hasDiscordLinked, performRoleCheck])

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
                  <div id="check-roles-action">
                    <Action
                      title={!hasDiscordLinked ? 'Link Discord' : 'Check Roles'}
                      description={
                        isCheckingRoles ? (
                          !hasDiscordLinked ? (
                            'Linking Discord...'
                          ) : (
                            'Checking eligibility...'
                          )
                        ) : roleCheckResult ? (
                          <div className="space-y-2">
                            <div
                              className={`font-medium ${
                                roleCheckResult ===
                                'All Discord roles assigned!'
                                  ? 'text-green-400'
                                  : roleCheckResult === 'Some roles assigned'
                                  ? 'text-yellow-400'
                                  : roleCheckResult.includes('Discord linked!')
                                  ? 'text-blue-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {roleCheckResult}
                            </div>
                            <div className="flex flex-col gap-1">
                              {citizenRoleStatus && (
                                <div
                                  className={`flex flex-col gap-1 px-3 py-2 rounded-lg border ${
                                    citizenRoleStatus.includes('Not Eligible')
                                      ? 'bg-red-900/20 border-red-500/30 text-red-400'
                                      : 'bg-green-900/20 border-green-500/30 text-green-400'
                                  }`}
                                >
                                  <span className="text-sm font-medium">
                                    {citizenRoleStatus}
                                  </span>
                                  {citizenErrorMessage && (
                                    <span className="text-xs text-gray-400 leading-tight">
                                      {citizenErrorMessage}
                                    </span>
                                  )}
                                </div>
                              )}
                              {voterRoleStatus && (
                                <div
                                  className={`flex flex-col gap-1 px-3 py-2 rounded-lg border ${
                                    voterRoleStatus.includes('Not Eligible')
                                      ? 'bg-red-900/20 border-red-500/30 text-red-400'
                                      : 'bg-green-900/20 border-green-500/30 text-green-400'
                                  }`}
                                >
                                  <span className="text-sm font-medium">
                                    {voterRoleStatus}
                                  </span>
                                  {voterErrorMessage && (
                                    <span className="text-xs text-gray-400 leading-tight">
                                      {voterErrorMessage}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : !hasDiscordLinked ? (
                          'Link your Discord account to get roles based on your Citizen NFT and vMOONEY.'
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
                  </div>

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
