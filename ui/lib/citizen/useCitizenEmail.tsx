import { usePrivy } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import { createSession, destroySession } from '../iron-session/iron-session'
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

      const res = await fetch(
        `/api/typeform/response?formId=${process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID}&responseId=${formResponseId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      const data = await res.json()

      const citizenEmail = data?.answers?.find(
        (a: any) => a.field.id === 'LzGGOX3e8Sfv'
      )?.email

      setEmail(citizenEmail)
      await destroySession(accessToken)
    }

    if (nft && address) getCitizenEmail()
  }, [nft, address, getAccessToken])

  return email
}
