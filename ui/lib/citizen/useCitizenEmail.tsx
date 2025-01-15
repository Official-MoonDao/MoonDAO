import { useEffect, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import fetchEmail from '../typeform/fetchEmail'
import { getAttribute } from '../utils/nft'

export default function useCitizenEmail(nft: any) {
  const account = useActiveAccount()
  const address = account?.address

  const [email, setEmail] = useState<string>()

  useEffect(() => {
    async function getCitizenEmail() {
      if (nft.owner !== address) return setEmail('')
      const formResponseId = getAttribute(
        nft?.metadata?.attributes,
        'formId'
      ).value

      try {
        const [
          citizenFormV1Email,
          citizenShortFormEmail,
          citizenEmailFormEmail,
        ] = await Promise.all([
          fetchEmail(
            process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
            formResponseId,
            'LzGGOX3e8Sfv'
          ),
          fetchEmail(
            process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID as string,
            formResponseId,
            'JEiG9XCW6M73'
          ),
          fetchEmail(
            process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID as string,
            formResponseId,
            'Z3IMkpvJUfdl'
          ),
        ])

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
