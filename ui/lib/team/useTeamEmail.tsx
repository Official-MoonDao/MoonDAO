import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { createSession, destroySession } from '../iron-session/iron-session'
import fetchEmail from '../typeform/fetchEmail'
import { getAttribute } from '../utils/nft'

export default function useTeamEmail(nft: any) {
  const { getAccessToken } = usePrivy()

  const [email, setEmail] = useState()

  useEffect(() => {
    async function getTeamEmail() {
      const accessToken = await getAccessToken()

      try {
        await createSession(accessToken)

        const formResponseId = getAttribute(
          nft?.metadata?.attributes,
          'formId'
        ).value

        const teamFormV1Email = await fetchEmail(
          process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
          formResponseId,
          'fQU0c6bZ8d0O',
          accessToken
        )

        const teamEmailFormEmail = await fetchEmail(
          process.env.NEXT_PUBLIC_TYPEFORM_TEAM_EMAIL_FORM_ID as string,
          formResponseId,
          'DiJuj1zkZpBc',
          accessToken
        )

        setEmail(teamEmailFormEmail || teamFormV1Email)
      } catch (err) {
        console.log(err)
      }
      await destroySession(accessToken)
    }

    if (nft) getTeamEmail()
  }, [nft, getAccessToken])

  return email
}
