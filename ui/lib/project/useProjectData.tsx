import { useAddress } from '@thirdweb-dev/react'
import { useState } from 'react'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { getAttribute } from '@/lib//utils/nft'

export default function useProjectData(
  projectContract: any,
  hatsContract: any,
  nft: any
) {
  const address = useAddress()

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isActive, setIsActive] = useState<boolean>(false)
  const [isManager, setIsManager] = useState<boolean>(false)
  const [subIsValid, setSubIsValid] = useState<boolean>(true)
  const [hatTreeId, setHatTreeId] = useState<string>()

  const { data: adminHatId } = useHandleRead(
    projectContract,
    'projectAdminHat',
    [nft?.metadata?.id || '']
  )

  const { data: managerHatId } = useHandleRead(
    projectContract,
    'projectManagerHat',
    [nft?.metadata?.id || '']
  )

  return {
    isLoading,
    isActive,
    isManager,
    subIsValid,
    adminHatId,
    managerHatId,
  }
}
