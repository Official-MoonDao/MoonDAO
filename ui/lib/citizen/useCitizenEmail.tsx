import { usePrivy } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import { getAttribute } from '../utils/nft'

export default function useCitizenEmail(nft: any) {
  const address = useAddress()
  const { getAccessToken } = usePrivy()

  const [email, setEmail] = useState<string>()

  async function getCitizenEmail() {
    if (nft.owner !== address) return setEmail('')
    const formResponseId = getAttribute(
      nft?.metadata?.attributes,
      'formId'
    ).value

    const accessToken = await getAccessToken()

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
      (a: any) => a.field.id === 'ggrOjApkLFMz'
    ).email

    setEmail(citizenEmail)
  }

  useEffect(() => {
    if (nft && address) getCitizenEmail()
  }, [nft, address])

  return email
}
