import { useAddress } from '@thirdweb-dev/react'
import { useEffect, useMemo, useState } from 'react'
import { useHandleRead } from '../thirdweb/hooks'
import { getAttribute } from '../utils/nft'

export function useTeamData(teamContract: any, hatsContract: any, nft: any) {
  const address = useAddress()

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isPublic, setIsPublic] = useState<boolean>(false)
  const [isDeleted, setIsDeleted] = useState<boolean>(false)
  const [isManager, setIsManager] = useState<boolean>(false)
  const [subIsValid, setSubIsValid] = useState<boolean>(true)
  const [hatTreeId, setHatTreeId] = useState<string>()

  const { data: adminHatId } = useHandleRead(teamContract, 'teamAdminHat', [
    nft?.metadata?.id || '',
  ])

  const { data: managerHatId } = useHandleRead(teamContract, 'teamManagerHat', [
    nft?.metadata?.id || '',
  ])

  const socials = useMemo(() => {
    const entityTwitter = getAttribute(nft.metadata.attributes, 'twitter')
    const entityCommunications = getAttribute(
      nft.metadata.attributes,
      'communications'
    )
    const entityWebsite = getAttribute(nft.metadata.attributes, 'website')
    return {
      twitter: entityTwitter?.value,
      communications: entityCommunications?.value,
      website: entityWebsite?.value,
    }
  }, [nft.metadata.attributes])

  useEffect(() => {
    function getView() {
      const entityView: any = getAttribute(nft.metadata.attributes, 'view')
      setIsPublic(entityView?.value === 'public' ? true : false)
      setIsDeleted(entityView?.value === '' ? true : false)
    }

    async function checkSubscription() {
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

    if (nft?.metadata?.attributes && teamContract) {
      ;(async () => {
        setIsLoading(true)
        await checkSubscription()
        getView()
        setIsLoading(false)
      })()
    }
  }, [nft, teamContract])

  useEffect(() => {
    async function checkManager() {
      try {
        if (address) {
          const isAddressManager = await teamContract.call('isManager', [
            nft?.metadata?.id,
            address,
          ])
          setIsManager(isAddressManager || nft.owner === address)
        } else {
          setIsManager(false)
        }
      } catch (err) {
        setIsManager(false)
      }
    }

    if (teamContract && nft?.metadata?.id) checkManager()
  }, [address, nft, teamContract])

  useEffect(() => {
    async function getHatTreeId() {
      const hatTreeId = await hatsContract.call('getTopHatDomain', [adminHatId])

      setHatTreeId(hatTreeId)
    }
    if (hatsContract && adminHatId) getHatTreeId()
  }, [adminHatId, hatsContract])

  return {
    socials,
    isPublic,
    isDeleted,
    hatTreeId,
    adminHatId,
    managerHatId,
    isManager,
    isLoading,
    subIsValid,
  }
}
