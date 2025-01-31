import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useMemo, useState } from 'react'
import { readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { getAttribute } from '../utils/nft'
import { addHttpsIfMissing } from '../utils/strings'

export function useTeamData(teamContract: any, hatsContract: any, nft: any) {
  const account = useActiveAccount()
  const address = account?.address

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isPublic, setIsPublic] = useState<boolean>(false)
  const [isDeleted, setIsDeleted] = useState<boolean>(false)
  const [isManager, setIsManager] = useState<boolean>(false)
  const [subIsValid, setSubIsValid] = useState<boolean>(true)
  const [hatTreeId, setHatTreeId] = useState<any>()
  const [adminHatId, setAdminHatId] = useState<any>()
  const [managerHatId, setManagerHatId] = useState<any>()

  const socials = useMemo(() => {
    const entityTwitter = getAttribute(nft?.metadata?.attributes, 'twitter')
    const entityCommunications = getAttribute(
      nft?.metadata?.attributes,
      'communications'
    )
    const entityWebsite = getAttribute(nft?.metadata?.attributes, 'website')
    return {
      twitter:
        entityTwitter?.value.startsWith('https://x.com/') ||
        entityTwitter?.value.startsWith('https://twitter.com/')
          ? entityTwitter.value
          : `https://x.com/${entityTwitter?.value.replace('https://', '')}`,
      communications: addHttpsIfMissing(entityCommunications?.value),
      website: addHttpsIfMissing(entityWebsite?.value),
    }
  }, [nft?.metadata?.attributes])

  useEffect(() => {
    function getView() {
      const entityView: any = getAttribute(nft?.metadata?.attributes, 'view')
      setIsPublic(entityView?.value === 'public' ? true : false)
      setIsDeleted(entityView?.value === '' ? true : false)
    }

    async function checkSubscription() {
      const now = Math.floor(Date.now() / 1000)

      try {
        const expiresAt = await readContract({
          contract: teamContract,
          method: 'expiresAt' as string,
          params: [nft?.metadata?.id],
        })
        setSubIsValid(+expiresAt.toString() > now)
      } catch (err) {
        console.log(err)
      }
    }

    async function getHats() {
      const results = await Promise.allSettled([
        readContract({
          contract: teamContract,
          method: 'teamAdminHat' as string,
          params: [nft?.metadata?.id || ''],
        }),
        readContract({
          contract: teamContract,
          method: 'teamManagerHat' as string,
          params: [nft?.metadata?.id || ''],
        }),
      ])

      const adminHID =
        results[0].status === 'fulfilled' ? results[0].value : null
      const managerHID =
        results[1].status === 'fulfilled' ? results[1].value : null

      setAdminHatId(adminHID)
      setManagerHatId(managerHID)
    }

    if (nft?.metadata?.attributes && teamContract) {
      ;(async () => {
        setIsLoading(true)
        await checkSubscription()
        await getHats()
        getView()
        setIsLoading(false)
      })()
    }
  }, [nft, teamContract])

  useEffect(() => {
    async function checkManager() {
      try {
        if (address) {
          const isAddressManager: any = await readContract({
            contract: teamContract,
            method: 'isManager' as string,
            params: [nft?.metadata?.id, address],
          })
          setIsManager(isAddressManager || nft.owner === address)
        } else {
          setIsManager(false)
        }
      } catch (err) {
        console.log(err)
        setIsManager(false)
      }
    }

    if (teamContract) checkManager()
  }, [account, address, nft, teamContract])

  useEffect(() => {
    async function getHatTreeId() {
      const hatTreeId = await readContract({
        contract: hatsContract,
        method: 'getTopHatDomain' as string,
        params: [adminHatId],
      })
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
