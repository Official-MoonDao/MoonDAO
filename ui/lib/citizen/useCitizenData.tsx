import { useEffect, useState } from 'react'

function getAttribute(attributes: any[], traitType: string) {
  return Object.values(attributes).find(
    (attr: any) => attr.trait_type === traitType
  )
}

export function useCitizenData(nft: any, citizenContract: any) {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [socials, setSocials] = useState<any>()
  const [isPublic, setIsPublic] = useState<boolean>(false)
  const [subIsValid, setSubIsValid] = useState<boolean>(false)

  function getView() {
    const entityView: any = getAttribute(nft.metadata.attributes, 'view')
    setIsPublic(entityView?.value === 'public' ? true : false)
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
      getCitizenSocials()
      getView()
      await checkSubscription()
      setIsLoading(false)
    })()
  }, [nft])

  return {
    socials,
    isPublic,
    subIsValid,
    isLoading,
  }
}
