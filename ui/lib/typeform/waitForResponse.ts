export default async function waitForResponse(
  formId: string,
  repsonseId: string
) {
  const res = await fetch(
    `/api/typeform/response?formId=${formId}&responseId=${repsonseId}`,
    {
      method: 'POST',
    }
  )

  const data = await res.json()

  if (data.answers) {
    return true
  } else {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await waitForResponse(formId, repsonseId)
  }
}
