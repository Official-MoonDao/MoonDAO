import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import { useContract, useResolvedMediaType } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import {
  CITIZEN_TABLE_ADDRESSES,
  CK_NEWSLETTER_FORM_ID,
  DEFAULT_CHAIN,
} from 'const/config'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import useSubscribe from '@/lib/convert-kit/useSubscribe'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { unpin } from '@/lib/ipfs/unpin'
import { createSession, destroySession } from '@/lib/iron-session/iron-session'
import cleanData from '@/lib/tableland/cleanData'
import { formatCitizenFormData } from '@/lib/typeform/citizenFormData'
import deleteResponse from '@/lib/typeform/deleteResponse'
import waitForResponse from '@/lib/typeform/waitForResponse'
import { renameFile } from '@/lib/utils/files'
import { getAttribute } from '@/lib/utils/nft'
import Modal from '../layout/Modal'
import { ImageGenerator } from '../onboarding/CitizenImageGenerator'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import DeleteProfileData from './DeleteProfileData'

export function CitizenMetadataModal({ nft, selectedChain, setEnabled }: any) {
  const router = useRouter()

  const [stage, setStage] = useState(0)
  const [inputImage, setInputImage] = useState<File>()
  const [currCitizenImage, setCurrCitizenImage] = useState<string>()
  const [newCitizenImage, setNewCitizenImage] = useState<File>()
  const [citizenData, setCitizenData] = useState<any>()
  const [formResponseId, setFormResponseId] = useState<string>()

  const { getAccessToken } = usePrivy()

  const resolvedMetadata = useResolvedMediaType(nft?.metadata?.uri)

  const { contract: citizenTableContract } = useContract(
    CITIZEN_TABLE_ADDRESSES[selectedChain.slug]
  )
  const subscribeToNewsletter = useSubscribe(CK_NEWSLETTER_FORM_ID)

  const submitTypeform = useCallback(
    async (formResponse: any) => {
      const accessToken = await getAccessToken()
      await createSession(accessToken)
      try {
        //get response from form
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
        const formattedCiizenData = formatCitizenFormData(
          data.answers,
          responseId
        )

        //escape single quotes and remove emojis
        const citizenData = cleanData(formattedCiizenData)

        if (citizenData.newsletterSub) {
          const subRes = await subscribeToNewsletter(citizenData.email)
          if (subRes.ok) {
            toast.success(
              'Successfully subscribed to the newsletter! Open your email and confirm your subscription.',
              { duration: 5000 }
            )
          }
        }

        setCitizenData(citizenData)
        setFormResponseId(responseId)
        setStage(2)
      } catch (err: any) {
        console.log(err)
      }
      await destroySession(accessToken)
    },
    [citizenTableContract]
  )

  useEffect(() => {
    async function getCurrCitizenImage() {
      const rawMetadataRes = await fetch(resolvedMetadata.url)
      const rawMetadata = await rawMetadataRes.json()
      const imageIpfsLink = rawMetadata.image
      setCurrCitizenImage(imageIpfsLink)
    }

    if (resolvedMetadata) getCurrCitizenImage()
  }, [resolvedMetadata])

  /*
  
  set initial citizen image if no upload


  */

  return (
    <Modal id="citizen-metadata-modal-backdrop" setEnabled={setEnabled}>
      <div className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[650px] p-5 bg-gradient-to-b from-dark-cool to-darkest-cool rounded-[2vmax] h-screen md:h-auto">
        <div className="w-full flex items-center justify-between">
          <h1 className="text-2xl font-GoodTimes">Update Info</h1>
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
            image={newCitizenImage}
            setImage={setNewCitizenImage}
            inputImage={inputImage}
            setInputImage={setInputImage}
            nextStage={() => setStage(1)}
            stage={stage}
            currImage={currCitizenImage}
          />
        )}
        {stage == 0 && (
          <DeleteProfileData
            nft={nft}
            setEnabled={setEnabled}
            tableContract={citizenTableContract}
            tokenId={nft.metadata.id}
            type="citizen"
          />
        )}
        {stage === 1 && (
          <>
            <Widget
              className="w-[100%] md:w-[100%]"
              id={process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string}
              onSubmit={submitTypeform}
              height={500}
            />
          </>
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
                    !newCitizenImage &&
                    rawMetadata.image &&
                    rawMetadata.image !== ''
                  ) {
                    imageIpfsLink = rawMetadata.image
                  } else {
                    if (!newCitizenImage) return console.error('No new image')

                    const renamedCitizenImage = renameFile(
                      newCitizenImage,
                      `${citizenData?.name} Citizen Image`
                    )

                    //pin new image
                    const { cid: newImageIpfsHash } = await pinBlobOrFile(
                      renamedCitizenImage
                    )

                    //unpin old image
                    await unpin(rawMetadata.image.split('ipfs://')[1])

                    imageIpfsLink = `ipfs://${newImageIpfsHash}`
                  }

                  //delete old typeform response
                  const oldFormResponseId = getAttribute(nft, 'formResponseId')
                  await deleteResponse(
                    process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
                    oldFormResponseId
                  )

                  const tx = await citizenTableContract?.call('updateTable', [
                    nft.metadata.id,
                    citizenData.name,
                    citizenData.description,
                    imageIpfsLink,
                    citizenData.location,
                    citizenData.discord,
                    citizenData.twitter,
                    citizenData.website,
                    citizenData.view,
                    formResponseId,
                  ])

                  setEnabled(false)

                  if (tx.receipt) {
                    setTimeout(() => {
                      router.reload()
                    }, 15000)
                  }
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
