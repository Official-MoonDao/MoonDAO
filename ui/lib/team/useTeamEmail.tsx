import { useEffect, useState } from 'react'
import fetchEmail from '../typeform/fetchEmail'
import { getAttribute } from '../utils/nft'

export default function useTeamEmail(nft: any) {
  const [email, setEmail] = useState()

  useEffect(() => {
    async function getTeamEmail() {
      try {
        const formResponseId = getAttribute(
          nft?.metadata?.attributes,
          'formId'
        ).value

        const [teamFormV1Email, teamEmailFormEmail] = await Promise.all([
          fetchEmail(
            process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
            formResponseId,
            'fQU0c6bZ8d0O'
          ),
          fetchEmail(
            process.env.NEXT_PUBLIC_TYPEFORM_TEAM_EMAIL_FORM_ID as string,
            formResponseId,
            'DiJuj1zkZpBc'
          ),
        ])

        setEmail(teamEmailFormEmail || teamFormV1Email)
      } catch (err) {
        console.log(err)
      }
    }

    if (nft) getTeamEmail()
  }, [nft])

  return email
}
