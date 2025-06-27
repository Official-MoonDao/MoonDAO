type WaitForRowOptions = {
  statement: string
  checkCondition?: (data: any[]) => boolean
  pollInterval?: number // milliseconds
  timeout?: number // milliseconds
  maxRetries?: number
}

type WaitForRowResult = {
  success: boolean
  data?: any[]
  error?: string
  attempts: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForRow(
  options: WaitForRowOptions
): Promise<WaitForRowResult> {
  const {
    statement,
    checkCondition = (data) => data && data.length > 0,
    pollInterval = 2000, // 2 seconds
    timeout = 60000, // 60 seconds
    maxRetries = 30,
  } = options

  const startTime = Date.now()
  let attempts = 0

  while (attempts < maxRetries && Date.now() - startTime < timeout) {
    attempts++

    try {
      const response = await fetch(
        `/api/tableland/query?statement=${encodeURIComponent(statement)}`
      )

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Unknown error' }))

        // For 500 errors, continue polling as the row might not exist yet
        if (response.status === 500) {
          await sleep(pollInterval)
          continue
        }

        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}`,
          attempts,
        }
      }

      const data = await response.json()

      if (checkCondition(data)) {
        return {
          success: true,
          data,
          attempts,
        }
      }
    } catch (error) {
      // Network or parsing errors - continue polling
      console.warn(`Attempt ${attempts} failed:`, error)
    }

    // Wait before next attempt
    await sleep(pollInterval)
  }

  return {
    success: false,
    error: attempts >= maxRetries ? 'Max retries exceeded' : 'Timeout exceeded',
    attempts,
  }
}

export async function waitForRowById(
  tableName: string,
  idColumn: string = 'id',
  idValue: string | number,
  options: Omit<WaitForRowOptions, 'statement' | 'checkCondition'> = {}
): Promise<WaitForRowResult> {
  const statement = `SELECT * FROM ${tableName} WHERE ${idColumn} = '${idValue}'`

  return waitForRow({
    ...options,
    statement,
    checkCondition: (data) => data && data.length > 0,
  })
}
