export default async function waitForResponse(
  formId: string,
  responseId: string,
  maxRetries: number = 20
): Promise<boolean> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const res = await fetch(
        `/api/typeform/response?formId=${formId}&responseId=${responseId}`,
        {
          method: 'POST',
        }
      )

      if (res.ok) {
        const data = await res.json()
        if (data.answers) {
          return true
        }
      } else {
        console.error(`API call failed with status: ${res.status}`)
      }
    } catch (error) {
      console.error('Error in waitForResponse:', error)
    }
    
    retries++
    if (retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
  
  throw new Error(`Failed to get response after ${maxRetries} attempts`)
}
