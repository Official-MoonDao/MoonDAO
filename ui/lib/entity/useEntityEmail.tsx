import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { getAttribute } from '../utils/nft'

export default function useEntityEmail(nft: any) {
  const { getAccessToken } = usePrivy()

  const [email, setEmail] = useState()

  async function getEntityEmail() {
    const formResponseId = getAttribute(
      nft?.metadata?.attributes,
      'formId'
    ).value

    const accessToken = await getAccessToken()

    const res = await fetch(
      `/api/typeform/response?formId=${process.env.NEXT_PUBLIC_TYPEFORM_ENTITY_FORM_ID}&responseId=${formResponseId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const data = await res.json()

    const entityEmail = data?.answers?.find(
      (a: any) => a.field.id === 'fQU0c6bZ8d0O'
    ).email

    setEmail(entityEmail)
  }

  useEffect(() => {
    if (nft) getEntityEmail()
  }, [nft])

  return email
}
