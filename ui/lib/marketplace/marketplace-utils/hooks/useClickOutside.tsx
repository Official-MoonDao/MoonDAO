import { useEffect } from 'react'

export function useClickOutside(
  ref: any,
  enabled: boolean,
  setEnabled: Function
) {
  useEffect(() => {
    function handleClickOutside(e: Event) {
      ref.current && !ref.current.contains(e.target) && setEnabled(false)
      document.removeEventListener('click', handleClickOutside)
    }

    if (enabled) {
      setTimeout(
        () => document.addEventListener('click', handleClickOutside),
        500
      )
    }
  }, [enabled, ref, setEnabled])

  return enabled
}
