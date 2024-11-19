import { useEffect, useMemo, useState } from 'react'
import useDiscordUserSearch from '../nance/DiscordUserSearch'
import { getAttribute } from '../utils/nft'

export function useCitizenData(nft: any, citizenContract: any) {
  const {
    metadata: { attributes },
  } = nft

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [subIsValid, setSubIsValid] = useState<boolean>(true)

  const isPublic = useMemo(() => {
    const view = getAttribute(attributes, 'view').value
    return view === 'public' ? true : false
  }, [attributes])

  const isDeleted = useMemo(() => {
    const view = getAttribute(attributes, 'view').value
    return view === '' ? true : false
  }, [attributes])

  const socials = useMemo(() => {
    const citizenTwitter = getAttribute(attributes, 'twitter')
    const citizenDiscord = getAttribute(attributes, 'discord')
    const citizenWebsite = getAttribute(attributes, 'website')
    return {
      twitter: citizenTwitter?.value,
      discord: citizenDiscord?.value,
      website: citizenWebsite?.value,
    }
  }, [attributes])

  const location = useMemo(() => {
    const loc = getAttribute(attributes, 'location')
    if (loc.value.startsWith('{')) {
      return JSON.parse(loc.value).name
    } else return loc?.value
  }, [attributes])

  const incompleteProfile = useMemo(() => {
    if (
      (nft.metadata.description !== '' || socials.twitter !== '',
      socials.discord !== '' || socials.website !== '' || location !== '')
    ) {
      return false
    } else {
      return true
    }
  }, [socials, location, nft.metadata])

  const discordUser = useDiscordUserSearch(socials?.discord, true)

  useEffect(() => {
    async function checkSubscription() {
      //get unix timestamp for now
      setIsLoading(true)
      const now = Math.floor(Date.now() / 1000)

      try {
        const expiresAt = await citizenContract.call('expiresAt', [
          nft?.metadata?.id,
        ])
        setSubIsValid(expiresAt.toNumber() > now)
      } catch (err) {
        console.log(err)
      }
      setIsLoading(false)
    }
    if (nft.metadata.attributes && citizenContract) checkSubscription()
  }, [nft.metadata, citizenContract])

  return {
    socials,
    location,
    discordLink: `https://discord.com/users/${discordUser?.data?.[0]?.user?.id}`,
    isPublic,
    isDeleted,
    subIsValid,
    incompleteProfile,
    isLoading,
  }
}
