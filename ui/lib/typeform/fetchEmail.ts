import { getAccessToken } from '@privy-io/react-auth'

export default async function fetchEmail(formId: string, responseId: string) {
  const accessToken = await getAccessToken()
  const res = await fetch(`/api/typeform/response`, {
    body: JSON.stringify({
      accessToken: accessToken,
      responseId: responseId,
      formId: formId,
      type: 'citizen',
    }),
    method: 'POST',
  })
  const data = await res.json()

  return data?.answers?.find((a: any) => a.field.type === 'email')?.email
}
