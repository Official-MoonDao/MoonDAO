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
import { TwitterIcon } from '../assets'

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
    <div id="citizen-actions-container" className="mb-6">
      {address.toLowerCase() === nft?.owner?.toLowerCase() && (
        <>
          <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 p-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 mb-6">
              <div className="flex gap-5">
                <h2 className="font-GoodTimes text-2xl text-white">Next Steps</h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {incompleteProfile && (
                <div className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors cursor-pointer group"
                     onClick={() => setCitizenMetadataModalEnabled(true)}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
                      <UserIcon height={24} width={24} className="text-white" />
                    </div>
                    <h3 className="font-bold text-white text-sm">Complete Profile</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Complete your profile by adding a bio, social links, or your location.
                  </p>
                </div>
              )}
              
              {!hasMooney && !hasVmooney && (
                <div className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors cursor-pointer group"
                     onClick={() => router.push('/get-mooney')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
                      <Image
                        src="/assets/icon-job.svg"
                        alt="Get Mooney"
                        height={24}
                        width={24}
                      />
                    </div>
                    <h3 className="font-bold text-white text-sm">Get Mooney</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    $MOONEY is our governance token, swap directly from within the website.
                  </p>
                </div>
              )}
              
              {hasMooney && !hasVmooney && (
                <div className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors cursor-pointer group"
                     onClick={() => router.push('/lock')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
                      <LockClosedIcon height={24} width={24} className="text-white" />
                    </div>
                    <h3 className="font-bold text-white text-sm">Lock to Vote</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Lock your MOONEY to acquire voting power and vote on proposals.
                  </p>
                </div>
              )}
              {hasMooney && !hasVmooney && (
                <div className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors cursor-pointer group"
                     onClick={() => router.push('/lock')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
                      <LockClosedIcon height={24} width={24} className="text-white" />
                    </div>
                    <h3 className="font-bold text-white text-sm">Lock to Vote</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Lock your MOONEY to acquire voting power and vote on proposals.
                  </p>
                </div>
              )}
              
              <div className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors cursor-pointer group"
                   onClick={() => {
                     window.open(
                       `https://x.com/intent/tweet?url=${window.location.href}&text=I%20just%20became%20a%20Citizen%20of%20the%20Space%20Acceleration%20Network%20%40OfficialMoonDAO`
                     )
                   }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
                    <TwitterIcon />
                  </div>
                  <h3 className="font-bold text-white text-sm">Share on X</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Share your citizen profile on X!
                </p>
              </div>
              
              <div className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors cursor-pointer group"
                   onClick={() => router.push('/proposals')}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
                    <Image
                      src="/assets/icon-project.svg"
                      alt="Create Project"
                      height={24}
                      width={24}
                    />
                  </div>
                  <h3 className="font-bold text-white text-sm">Create Project</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Submit a proposal to secure funding for your space project.
                </p>
              </div>
              
              <div className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors cursor-pointer group"
                   onClick={() => router.push('/contributions')}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
                    <Image
                      src="/assets/icon-submit.svg"
                      alt="Submit Contribution"
                      height={24}
                      width={24}
                    />
                  </div>
                  <h3 className="font-bold text-white text-sm">Submit Contribution</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Get rewarded for mission-aligned work towards a lunar settlement.
                </p>
              </div>
              
              <div className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors cursor-pointer group"
                   onClick={() => router.push('/map')}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
                    <GlobeAmericasIcon height={24} width={24} className="text-white" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Explore Map</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Connect with fellow members of the Network both locally and globally.
                </p>
              </div>
              
              <div id="check-roles-action" 
                   className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors cursor-pointer group"
                   onClick={isCheckingRoles ? undefined : checkDiscordRoles}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
                    {isCheckingRoles ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    ) : (
                      <CheckCircleIcon height={24} width={24} className="text-white" />
                    )}
                  </div>
                  <h3 className="font-bold text-white text-sm">
                    {!hasDiscordLinked ? 'Link Discord' : 'Check Roles'}
                  </h3>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  {isCheckingRoles ? (
                    !hasDiscordLinked ? (
                      'Linking Discord...'
                    ) : (
                      'Checking eligibility...'
                    )
                  ) : roleCheckResult ? (
                    <div className="space-y-2">
                      <div
                        className={`font-medium text-xs ${
                          roleCheckResult === 'All Discord roles assigned!'
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
                            className={`flex flex-col gap-1 px-2 py-1 rounded border text-xs ${
                              citizenRoleStatus.includes('Not Eligible')
                                ? 'bg-red-900/20 border-red-500/30 text-red-400'
                                : 'bg-green-900/20 border-green-500/30 text-green-400'
                            }`}
                          >
                            <span className="font-medium">
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
                            className={`flex flex-col gap-1 px-2 py-1 rounded border text-xs ${
                              voterRoleStatus.includes('Not Eligible')
                                ? 'bg-red-900/20 border-red-500/30 text-red-400'
                                : 'bg-green-900/20 border-green-500/30 text-green-400'
                            }`}
                          >
                            <span className="font-medium">
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
                  )}
                </div>
              </div>

              {!isTeamMember && (
                <div className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors cursor-pointer group"
                     onClick={() => router.push('/team')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
                      <PlusIcon height={24} width={24} className="text-white" />
                    </div>
                    <h3 className="font-bold text-white text-sm">Create a Team</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Join a team or create your own to work together on accelerating space.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
