import { useEffect } from 'react'

export function useHandleError(method: string, error: any, args?: any[]) {
  useEffect(() => {
    if (args && args.length > 0) {
      if (method && error) console.log('Method:' + method, error)
    }
  }, [error, args ,method])
}
