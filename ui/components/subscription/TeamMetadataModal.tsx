import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import { useContract, useResolvedMediaType } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { DEFAULT_CHAIN, TEAM_TABLE_ADDRESSES } from 'const/config'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { unpin } from '@/lib/ipfs/unpin'
import { createSession, destroySession } from '@/lib/iron-session/iron-session'
import cleanData from '@/lib/tableland/cleanData'
import deleteResponse from '@/lib/typeform/deleteResponse'
import formatTeamFormData from '@/lib/typeform/teamFormData'
import waitForResponse from '@/lib/typeform/waitForResponse'
import { renameFile } from '@/lib/utils/files'
import { getAttribute } from '@/lib/utils/nft'
import Modal from '../layout/Modal'
import { ImageGenerator } from '../onboarding/TeamImageGenerator'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import DeleteProfileData from './DeleteProfileData'

export default function TeamMetadataModal({
  nft,
  selectedChain,
  setEnabled,
}: any) {
  const router = useRouter()

  const [stage, setStage] = useState(0)

  const [currTeamImage, setCurrTeamImage] = useState<string>()
  const [newTeamImage, setNewTeamImage] = useState<File>()
  const [teamData, setTeamData] = useState<any>()
  const [formResponseId, setFormResponseId] = useState<string>()

  const { getAccessToken } = usePrivy()

  const resolvedMetadata = useResolvedMediaType(nft?.metadata?.uri)

  const { contract: teamTableContract } = useContract(
    TEAM_TABLE_ADDRESSES[selectedChain.slug]
  )

  const submitTypeform = useCallback(
    async (formResponse: any) => {
      const accessToken = await getAccessToken()
      await createSession(accessToken)

      //get response from form

      try {
        const { formId, responseId } = formResponse

        await waitForResponse(formId, responseId, accessToken)

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
        setTeamData(teamData)
        setFormResponseId(responseId)
        setStage(2)
      } catch (err: any) {
        console.log(err)
      }
      await destroySession(accessToken)
    },
    [teamTableContract, newTeamImage]
  )

  useEffect(() => {
    async function getCurrTeamImage() {
      const rawMetadataRes = await fetch(resolvedMetadata.url)
      const rawMetadata = await rawMetadataRes.json()
      const imageIpfsLink = rawMetadata.image
      setCurrTeamImage(imageIpfsLink)
    }
    getCurrTeamImage()
  }, [resolvedMetadata])

  return (
    <Modal id="entity-metadata-modal-backdrop" setEnabled={setEnabled}>
      <div className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[650px] p-5 bg-gradient-to-b from-dark-cool to-darkest-cool rounded-[2vmax] h-screen md:h-auto">
        <div className="w-full flex items-center justify-between">
          <h1 className="text-2xl font-GoodTimes ">Update Info</h1>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        {stage === 0 && (
          <ImageGenerator
            setImage={setNewTeamImage}
            nextStage={() => setStage(1)}
            stage={stage}
            currImage={currTeamImage}
          />
        )}
        {stage === 0 && (
          <DeleteProfileData
            nft={nft}
            setEnabled={setEnabled}
            tableContract={teamTableContract}
            tokenId={nft.metadata.id}
            type="team"
          />
        )}
        {stage === 1 && (
          <Widget
            className="w-[100%] md:w-[100%]"
            id={process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string}
            onSubmit={submitTypeform}
            height={500}
          />
        )}
        {stage === 2 && (
          <div>
            <p>Submit your new info</p>
            <PrivyWeb3Button
              requiredChain={DEFAULT_CHAIN}
              label="Submit"
              action={async () => {
                const accessToken = await getAccessToken()
                await createSession(accessToken)
                try {
                  const rawMetadataRes = await fetch(resolvedMetadata.url)
                  const rawMetadata = await rawMetadataRes.json()

                  let imageIpfsLink
                  if (
                    !newTeamImage &&
                    rawMetadata.image &&
                    rawMetadata.image !== ''
                  ) {
                    imageIpfsLink = rawMetadata.image
                  } else {
                    if (!newTeamImage) return console.error('No new image')

                    const renamedTeamImage = renameFile(
                      newTeamImage,
                      `${teamData?.name} Team Image`
                    )

                    //pin new image
                    const { cid: newImageIpfsHash } = await pinBlobOrFile(
                      renamedTeamImage
                    )

                    //unpin old iamge
                    await unpin(rawMetadata.image.split('ipfs://')[1])

                    imageIpfsLink = `ipfs://${newImageIpfsHash}`
                  }

                  //delete old typeform response
                  const oldFormResponseId = getAttribute(nft, 'formResponseId')
                  await deleteResponse(
                    process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
                    oldFormResponseId
                  )

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
                    formResponseId,
                  ])

                  setEnabled(false)

                  setTimeout(() => {
                    router.reload()
                  }, 15000)
                } catch (err) {
                  console.log(err)
                }
                await destroySession(accessToken)
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
