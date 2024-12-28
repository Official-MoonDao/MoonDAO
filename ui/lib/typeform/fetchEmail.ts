export default async function fetchEmail(
  formId: string,
  responseId: string,
  fieldId: string
) {
  const res = await fetch(
    `/api/typeform/response?formId=${formId}&responseId=${responseId}`,
    {
      method: 'POST',
    }
  )
  const data = await res.json()
  return data?.answers?.find((a: any) => a.field.id === fieldId)?.email
}
