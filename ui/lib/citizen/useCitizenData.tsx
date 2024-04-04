import { useEffect, useState } from 'react'

function getAttribute(attributes: any[], traitType: string) {
  return Object.values(attributes).find(
    (attr: any) => attr.trait_type === traitType
  )
}

export function useCitizenData(nft: any) {
  const [socials, setSocials] = useState<any>()
  const [isPublic, setIsPublic] = useState<boolean>(false)

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

  useEffect(() => {
    if (!nft?.metadata?.attributes) return
    getCitizenSocials()
    getView()
  }, [nft])

  return {
    socials,
    isPublic,
  }
}
