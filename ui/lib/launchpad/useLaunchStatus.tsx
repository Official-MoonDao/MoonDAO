import { useLogin, usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import { LaunchStatus, LaunchStatusResult, UserTeam } from './types'

export function useLaunchStatus(
  userTeamsAsManager: UserTeam[] | undefined
): LaunchStatusResult {
  const router = useRouter()
  const shallowQuery = useShallowQueryRoute()
  const account = useActiveAccount()
  const { user } = usePrivy()
  
  const [status, setStatus] = useState<LaunchStatus>(
    (router.query.status as LaunchStatus) || 'idle'
  )

  const { login } = useLogin()

  const handleCreateMission = useCallback(async () => {
    if (!user) {
      setStatus('loggingIn')
      login()
      return
    }
    const isWhitelisted = true
    if ((userTeamsAsManager && userTeamsAsManager.length > 0) || isWhitelisted) {
      setStatus('create')
    } else {
      setStatus('apply')
    }
  }, [user, userTeamsAsManager, login])

  useEffect(() => {
    if (status) {
      shallowQuery({
        status: status,
      })
    }
  }, [status, shallowQuery])

  useEffect(() => {
    if (router.query.status) {
      if (
        !(
          user &&
          router.query.status === 'loggingIn' &&
          (status === 'create' || status === 'apply')
        )
      ) {
        setStatus(router.query.status as LaunchStatus)
      }
    } else {
      setStatus('idle')
    }
  }, [router.query.status, user, status])

  useEffect(() => {
    if ((router.query.status === 'create' || router.query.status === 'loggingIn') && !account) {
      login()
    }
  }, [router.query.status, account, login])

  return {
    status,
    setStatus,
    handleCreateMission,
  }
}

