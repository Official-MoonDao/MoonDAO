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

        const teamEmail = await fetchEmail(
          process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
          formResponseId
        )

        setEmail(teamEmail)
      } catch (err) {
        console.log(err)
      }
    }

    if (nft) getTeamEmail()
  }, [nft])

  return email
}
