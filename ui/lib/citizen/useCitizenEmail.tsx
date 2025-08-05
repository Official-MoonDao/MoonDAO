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
      if (nft.owner.toLowerCase() !== address?.toLowerCase())
        return setEmail('')
      const formResponseId = getAttribute(
        nft?.metadata?.attributes,
        'formId'
      ).value

      try {
        const citizenEmail = await fetchEmail(
          process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
          formResponseId
        )

        setEmail(citizenEmail)
      } catch (err: any) {
        console.log(err)
      }
    }

    if (nft && address) getCitizenEmail()
  }, [nft, address])

  return email
}
