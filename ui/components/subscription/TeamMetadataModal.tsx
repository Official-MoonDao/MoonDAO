import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import {
  useAddress,
  useContract,
  useResolvedMediaType,
} from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { TEAM_TABLE_ADDRESSES } from 'const/config'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import { pinImageToIPFS } from '@/lib/ipfs/pin'
import cleanData from '@/lib/tableland/cleanData'
import formatTeamFormData from '@/lib/typeform/teamFormData'
import Modal from '../layout/Modal'
import { ImageGenerator } from '../onboarding/TeamImageGenerator'
import DeleteProfileData from './DeleteProfileData'

export default function TeamMetadataModal({
  nft,
  selectedChain,
  setEnabled,
}: any) {
  const router = useRouter()

  const { getAccessToken } = usePrivy()

  const resolvedMetadata = useResolvedMediaType(nft?.metadata?.uri)

  const { contract: teamTableContract } = useContract(
    TEAM_TABLE_ADDRESSES[selectedChain.slug]
  )

  const submitTypeform = useCallback(
    async (formResponse: any) => {
      const accessToken = await getAccessToken()

      //get response from form
      const { formId, responseId } = formResponse

      try {
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

        //format answers into an object
        const formattedTeamData = formatTeamFormData(data.answers, responseId)

        //escape single quotes and remove emojis
        const teamData = cleanData(formattedTeamData)

        const rawMetadataRes = await fetch(resolvedMetadata.url)
        const rawMetadata = await rawMetadataRes.json()
        const imageIpfsLink = rawMetadata.image

        //mint NFT to safe
        await teamTableContract?.call('updateTable', [
          nft.metadata.id,
          teamData.name,
          teamData.description,
          imageIpfsLink,
          teamData.twitter,
          teamData.communications,
          teamData.website,
          teamData.view,
          teamData.formResponseId,
        ])

        setTimeout(() => {
          router.reload()
        }, 10000)
      } catch (err: any) {
        console.log(err)
      }
    },
    [teamTableContract]
  )

  return (
    <Modal id="entity-metadata-modal-backdrop" setEnabled={setEnabled}>
      <div className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[650px] p-4 md:p-8 bg-darkest-cool rounded-md">
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
          id={process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string}
          onSubmit={submitTypeform}
          height={500}
        />
        <DeleteProfileData
          resolvedMetadata={resolvedMetadata}
          setEnabled={setEnabled}
          tableContract={teamTableContract}
          tokenId={nft.metadata.id}
          type="team"
        />
      </div>
    </Modal>
  )
}
