export default async function fetchEmail(
  formId: string,
  responseId: string,
  fieldId: string,
  accessToken: string | null
) {
  const res = await fetch(
    `/api/typeform/response?formId=${formId}&responseId=${responseId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
  const data = await res.json()
  return data?.answers?.find((a: any) => a.field.id === fieldId)?.email
}
