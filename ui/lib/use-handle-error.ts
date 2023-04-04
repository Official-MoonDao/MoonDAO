import { useEffect } from 'react'
import { useErrorContext } from '../components/layout/ErrorProvider'

// For some contract interactions, a reverted call is not an error
export function useHandleError(object: any, throwOnRevert = true) {
  const errorContext = useErrorContext()
  useEffect(() => {
    if (
      !object.error?.message?.startsWith(
        'missing revert data in call exception;'
      ) &&
      !object.reason?.includes('missing revert') &&
      throwOnRevert &&
      object.error
    ) {
      errorContext.addError([object.error])
    }
  }, [object.error, throwOnRevert])
  return object
}
