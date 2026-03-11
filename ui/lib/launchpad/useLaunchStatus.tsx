import { useLogin, usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import { LaunchStatus, LaunchStatusResult, UserTeam } from './types'

export function useLaunchStatus(
  userTeamsAsManager: UserTeam[] | undefined
): LaunchStatusResult {
  const router = useRouter()
  const shallowQuery = useShallowQueryRoute()
  const shallowQueryRef = useRef(shallowQuery)
  shallowQueryRef.current = shallowQuery

  const account = useActiveAccount()
  const { user } = usePrivy()
  
  const [status, setStatus] = useState<LaunchStatus>(
    (router.query.status as LaunchStatus) || 'idle'
  )

  // Keep a ref so the URL→state effect can read current status
  // without having it as a dependency (which caused the reset loop)
  const statusRef = useRef(status)
  statusRef.current = status

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

  // Sync status state → URL
  // Use ref for shallowQuery to avoid re-firing every render
  // (useShallowQueryRoute returns a new function reference each render)
  useEffect(() => {
    if (status) {
      shallowQueryRef.current({
        status: status,
      })
    }
  }, [status])

  // Sync URL → status state
  // Only fire when router.query.status or user changes, NOT when status changes.
  // Use statusRef to read current status without adding it as a dependency,
  // which previously caused a race condition: status changed → this effect fired →
  // router.query.status was still stale/undefined → reset status back to 'idle'.
  useEffect(() => {
    if (router.query.status) {
      if (
        !(
          user &&
          router.query.status === 'loggingIn' &&
          (statusRef.current === 'create' || statusRef.current === 'apply')
        )
      ) {
        setStatus(router.query.status as LaunchStatus)
      }
    } else {
      setStatus('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.status, user])

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

