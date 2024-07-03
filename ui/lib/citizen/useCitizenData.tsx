import { useEffect, useState } from 'react'
import useDiscordUserSearch from '../nance/DiscordUserSearch'
import { getAttribute } from '../utils/nft'

export function useCitizenData(nft: any, citizenContract: any) {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [socials, setSocials] = useState<any>()
  const [isPublic, setIsPublic] = useState<boolean>(false)
  const [isDeleted, setIsDeleted] = useState<boolean>(false)
  const [subIsValid, setSubIsValid] = useState<boolean>(true)

  const discordUser = useDiscordUserSearch(socials?.discord, true)

  useEffect(() => {
    setSocials((prev: any) => ({
      ...prev,
      discordLink: `https://discord.com/users/${discordUser?.data?.[0]?.user?.id}`,
    }))
  }, [discordUser])

  function getView() {
    const citizenView: any = getAttribute(nft.metadata.attributes, 'view')
    setIsPublic(citizenView?.value === 'public' ? true : false)
    setIsDeleted(citizenView?.value === '' ? true : false)
  }

  function getCitizenSocials() {
    const citizenTwitter = getAttribute(nft.metadata.attributes, 'twitter')
    const citizenDiscord = getAttribute(nft.metadata.attributes, 'discord')
    const citizenWebsite = getAttribute(nft.metadata.attributes, 'website')
    setSocials({
      twitter: citizenTwitter?.value,
      discord: citizenDiscord?.value,
      website: citizenWebsite?.value,
    })
  }

  //check if the subscription is valid
  async function checkSubscription() {
    //get unix timestamp for now
    const now = Math.floor(Date.now() / 1000)

    try {
      const expiresAt = await citizenContract.call('expiresAt', [
        nft?.metadata?.id,
      ])
      setSubIsValid(expiresAt.toNumber() > now)
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    if (!nft?.metadata?.attributes) return
    ;(async () => {
      setIsLoading(true)
      await checkSubscription()
      getCitizenSocials()
      getView()
      setIsLoading(false)
    })()
  }, [nft])

  useEffect(() => {}, [])

  return {
    socials,
    isPublic,
    isDeleted,
    subIsValid,
    isLoading,
  }
}
