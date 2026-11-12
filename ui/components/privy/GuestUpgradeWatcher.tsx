import { useLogin } from '@privy-io/react-auth'
import { useRef } from 'react'
import { useForecastWriter } from '@/lib/forecasts/useForecastWriter'

/**
 * Sign in from a guest session upgrades the guest. When the login the guest
 * picks already belongs to an account, Privy refuses the upgrade, so move the
 * guest's forecasts to that account instead.
 */
export default function GuestUpgradeWatcher() {
  const { isGuest, switchToExistingAccount } = useForecastWriter()
  const running = useRef(false)
  const guestRef = useRef(isGuest)
  guestRef.current = isGuest
  const switchRef = useRef(switchToExistingAccount)
  switchRef.current = switchToExistingAccount

  useLogin({
    onError: (error) => {
      if (error !== 'linked_to_another_user' || !guestRef.current || running.current) return
      running.current = true
      void switchRef.current().finally(() => {
        running.current = false
      })
    },
  })

  return null
}
