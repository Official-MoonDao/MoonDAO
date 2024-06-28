import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import { useContract, useResolvedMediaType } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { CITIZEN_TABLE_ADDRESSES } from 'const/config'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useNewsletterSub } from '@/lib/convert-kit/useNewsletterSub'
import isTextInavlid from '@/lib/tableland/isTextValid'
import formatCitizenFormData from '@/lib/typeform/citizenFormData'

export function CitizenMetadataModal({ nft, selectedChain, setEnabled }: any) {
  const router = useRouter()
  const { getAccessToken } = usePrivy()

  const resolvedMetadata = useResolvedMediaType(nft?.metadata?.uri)

  const { contract: citizenTableContract } = useContract(
    CITIZEN_TABLE_ADDRESSES[selectedChain.slug]
  )

  const subscribeToNewsletter = useNewsletterSub()

  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'citizen-metadata-modal-backdrop') setEnabled(false)
      }}
      id="citizen-metadata-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <div className="w-full flex items-center justify-between">
          <h1 className="text-2xl font-bold">Update Info</h1>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <Widget
          className="w-[100%] md:w-[100%]"
          id={process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string}
          onSubmit={async (formResponse: any) => {
            // sign message to get response
            const accessToken = await getAccessToken()

            //get response from form
            const { formId, responseId } = formResponse
            const responseRes = await fetch(
              `/api/typeform/response?formId=${formId}&responseId=${responseId}`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            )
            const data = await responseRes.json()

            const citizenData = formatCitizenFormData(data.answers, responseId)

            const rawMetadataRes = await fetch(resolvedMetadata.url)
            const rawMetadata = await rawMetadataRes.json()
            const imageIPFSLink = rawMetadata.image

            const invalidText = Object.values(citizenData).some((v: any) =>
              isTextInavlid(v)
            )

            if (invalidText) {
              return
            }

            if (citizenData.newsletterSub) {
              const subRes = await subscribeToNewsletter(citizenData.email)
              if (subRes.ok) {
                toast.success(
                  'Successfully subscribed to the newsletter! Open your email and confirm your subscription.'
                )
              }
            }

            await citizenTableContract?.call('updateTable', [
              nft.metadata.id,
              `${citizenData.firstName} ${citizenData.lastName}`,
              citizenData.description,
              imageIPFSLink,
              citizenData.location,
              citizenData.discord,
              citizenData.twitter,
              citizenData.website,
              citizenData.view,
              responseId,
            ])

            setTimeout(() => {
              router.reload()
            }, 5000)
          }}
          height={500}
        />
      </div>
    </div>
  )
}
