export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new TimeoutError(
          errorMessage || `Operation timed out after ${timeoutMs}ms`
        )
      )
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle)
  })
}

export function withTimeoutAndWarning<T>(
  promise: Promise<T>,
  timeoutMs: number,
  warningMs: number,
  onWarning: () => void,
  errorMessage?: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout
  let warningHandle: NodeJS.Timeout

  warningHandle = setTimeout(() => {
    onWarning()
  }, warningMs)

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new TimeoutError(
          errorMessage || `Operation timed out after ${timeoutMs}ms`
        )
      )
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle)
    clearTimeout(warningHandle)
  })
}
