import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import { useHandleRead } from '../thirdweb/hooks'
import { getAttribute } from '../utils/nft'

export function useTeamData(teamContract: any, hatsContract: any, nft: any) {
  const address = useAddress()
  const { wallets } = useWallets()

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [socials, setSocials] = useState<any>()
  const [isPublic, setIsPublic] = useState<boolean>(false)
  const [hatTreeId, setHatTreeId] = useState()
  const [isManager, setIsManager] = useState<boolean>(false)
  const [subIsValid, setSubIsValid] = useState<boolean>(true)

  const { data: adminHatId } = useHandleRead(teamContract, 'entityAdminHat', [
    nft?.metadata?.id || '',
  ])

  async function getHatTreeId() {
    const hatTreeId = await hatsContract.call('getTopHatDomain', [adminHatId])

    setHatTreeId(hatTreeId)
  }

  function getView() {
    const entityView: any = getAttribute(nft.metadata.attributes, 'view')
    setIsPublic(entityView?.value === 'public' ? true : false)
  }

  function getEntitySocials() {
    const entityTwitter = getAttribute(nft.metadata.attributes, 'twitter')
    const entityCommunications = getAttribute(
      nft.metadata.attributes,
      'communications'
    )
    const entityWebsite = getAttribute(nft.metadata.attributes, 'website')
    setSocials({
      twitter: entityTwitter?.value,
      communications: entityCommunications?.value,
      website: entityWebsite?.value,
    })
  }

  async function checkManager() {
    try {
      if (address) {
        const isAddressManager = await teamContract.call('isManager', [
          nft?.metadata?.id,
          address,
        ])
        setIsManager(isAddressManager)
      } else {
        setIsManager(false)
      }
    } catch (err) {
      setIsManager(false)
    }
  }

  async function checkSubscription() {
    //get unix timestamp for now
    const now = Math.floor(Date.now() / 1000)

    try {
      const expiresAt = await teamContract.call('expiresAt', [
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
      getEntitySocials()
      getView()
      setIsLoading(false)
    })()
  }, [nft])

  useEffect(() => {
    if (teamContract && nft?.metadata?.id) checkManager()
  }, [address, nft, teamContract])

  useEffect(() => {
    if (hatsContract && adminHatId) getHatTreeId()
  }, [adminHatId, hatsContract])

  return {
    socials,
    isPublic,
    hatTreeId,
    adminHatId,
    isManager,
    isLoading,
    subIsValid,
  }
}
