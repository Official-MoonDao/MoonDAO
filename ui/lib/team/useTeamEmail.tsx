import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { createSession, destroySession } from '../iron-session/iron-session'
import { getAttribute } from '../utils/nft'

export default function useTeamEmail(nft: any) {
  const { getAccessToken } = usePrivy()

  const [email, setEmail] = useState()

  useEffect(() => {
    async function getTeamEmail() {
      const accessToken = await getAccessToken()

      await createSession(accessToken)

      const formResponseId = getAttribute(
        nft?.metadata?.attributes,
        'formId'
      ).value

      const res = await fetch(
        `/api/typeform/response?formId=${process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID}&responseId=${formResponseId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      const data = await res.json()

      const teamEmail = data?.answers?.find(
        (a: any) => a.field.id === 'fQU0c6bZ8d0O'
      ).email

      setEmail(teamEmail)
      await destroySession(accessToken)
    }

    if (nft) getTeamEmail()
  }, [nft, getAccessToken])

  return email
}
