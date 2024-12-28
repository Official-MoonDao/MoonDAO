import { useAddress } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import fetchEmail from '../typeform/fetchEmail'
import { getAttribute } from '../utils/nft'

export default function useCitizenEmail(nft: any) {
  const address = useAddress()

  const [email, setEmail] = useState<string>()

  useEffect(() => {
    async function getCitizenEmail() {
      if (nft.owner !== address) return setEmail('')
      const formResponseId = getAttribute(
        nft?.metadata?.attributes,
        'formId'
      ).value

      try {
        const citizenFormV1Email = await fetchEmail(
          process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
          formResponseId,
          'LzGGOX3e8Sfv'
        )

        const citizenShortFormEmail = await fetchEmail(
          process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID as string,
          formResponseId,
          'JEiG9XCW6M73'
        )

        const citizenEmailFormEmail = await fetchEmail(
          process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID as string,
          formResponseId,
          'Z3IMkpvJUfdl'
        )

        setEmail(
          citizenEmailFormEmail || citizenShortFormEmail || citizenFormV1Email
        )
      } catch (err: any) {
        console.log(err)
      }
    }

    if (nft && address) getCitizenEmail()
  }, [nft, address])

  return email
}
