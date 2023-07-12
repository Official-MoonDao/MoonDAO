import { useEffect } from 'react'

export function useHandleError(method: string, error: any) {
  useEffect(() => {
    console.log('Method:' + method, error)
  }, [error])
}
