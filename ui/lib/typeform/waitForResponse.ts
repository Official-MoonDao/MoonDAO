export default async function waitForResponse(
  formId: string,
  repsonseId: string,
  accessToken: string | null
) {
  const res = await fetch(
    `/api/typeform/response?formId=${formId}&responseId=${repsonseId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  const data = await res.json()

  if (data.answers) {
    return true
  } else {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await waitForResponse(formId, repsonseId, accessToken)
  }
}
