import { usePrivy } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import { createSession, destroySession } from '../iron-session/iron-session'
import fetchEmail from '../typeform/fetchEmail'
import { getAttribute } from '../utils/nft'

export default function useCitizenEmail(nft: any) {
  const address = useAddress()
  const { getAccessToken } = usePrivy()

  const [email, setEmail] = useState<string>()

  useEffect(() => {
    async function getCitizenEmail() {
      if (nft.owner !== address) return setEmail('')
      const accessToken = await getAccessToken()
      await createSession(accessToken)
      const formResponseId = getAttribute(
        nft?.metadata?.attributes,
        'formId'
      ).value

      try {
        const citizenFormV1Email = await fetchEmail(
          process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
          formResponseId,
          'LzGGOX3e8Sfv',
          accessToken
        )

        const citizenShortFormEmail = await fetchEmail(
          process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID as string,
          formResponseId,
          'JEiG9XCW6M73',
          accessToken
        )

        const citizenEmailFormEmail = await fetchEmail(
          process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID as string,
          formResponseId,
          'Z3IMkpvJUfdl',
          accessToken
        )

        setEmail(
          citizenEmailFormEmail || citizenShortFormEmail || citizenFormV1Email
        )
      } catch (err: any) {
        console.log(err)
      }
      await destroySession(accessToken)
    }

    if (nft && address) getCitizenEmail()
  }, [nft, address, getAccessToken])

  return email
}
