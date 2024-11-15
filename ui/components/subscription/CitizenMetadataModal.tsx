import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import { useContract, useResolvedMediaType } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { CITIZEN_TABLE_ADDRESSES, DEFAULT_CHAIN } from 'const/config'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { unpin } from '@/lib/ipfs/unpin'
import { createSession, destroySession } from '@/lib/iron-session/iron-session'
import cleanData from '@/lib/tableland/cleanData'
import deleteResponse from '@/lib/typeform/deleteResponse'
import waitForResponse from '@/lib/typeform/waitForResponse'
import { renameFile } from '@/lib/utils/files'
import { getAttribute } from '@/lib/utils/nft'
import FormInput from '../forms/FormInput'
import Modal from '../layout/Modal'
import { ImageGenerator } from '../onboarding/CitizenImageGenerator'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import DeleteProfileData from './DeleteProfileData'

function CitizenMetadataForm({ citizenData, setCitizenData }: any) {
  return (
    <div className="w-full flex flex-col gap-2">
      <FormInput
        label="Name"
        value={citizenData?.name}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({ ...prev, name: target.value }))
        }
        placeholder="Enter your name"
      />
      <FormInput
        label="Bio"
        value={citizenData?.description}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({
            ...prev,
            description: target.value,
          }))
        }
        placeholder="Enter your bio"
      />
      <FormInput
        label="Location"
        value={citizenData?.location}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({ ...prev, location: target.value }))
        }
        placeholder="Enter your location"
      />
      <FormInput
        label="Discord"
        value={citizenData?.discord}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({ ...prev, discord: target.value }))
        }
        placeholder="Enter your discord username"
      />
      <FormInput
        label="Twitter"
        value={citizenData?.twitter}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({ ...prev, twitter: target.value }))
        }
        placeholder="Enter your twitter link"
      />
      <FormInput
        label="Website"
        value={citizenData?.website}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({ ...prev, website: target.value }))
        }
        placeholder="Enter your website link"
      />
    </div>
  )
}

export default function CitizenMetadataModal({
  nft,
  selectedChain,
  setEnabled,
}: any) {
  const router = useRouter()

  const [stage, setStage] = useState(0)
  const [inputImage, setInputImage] = useState<File>()
  const [currCitizenImage, setCurrCitizenImage] = useState<string>()
  const [newCitizenImage, setNewCitizenImage] = useState<File>()
  const [citizenData, setCitizenData] = useState<any>()
  const [formResponseId, setFormResponseId] = useState<string>(
    getAttribute(nft?.metadata?.attributes, 'formId').value
  )

  const { getAccessToken } = usePrivy()

  const resolvedMetadata = useResolvedMediaType(nft?.metadata?.uri)

  const { contract: citizenTableContract } = useContract(
    CITIZEN_TABLE_ADDRESSES[selectedChain.slug]
  )

  const submitTypeform = useCallback(
    async (formResponse: any) => {
      const accessToken = await getAccessToken()
      await createSession(accessToken)
      try {
        //get response from form
        const { formId, responseId } = formResponse

        await waitForResponse(formId, responseId, accessToken)

        const res = await fetch(
          `/api/typeform/response?formId=${formId}&responseId=${responseId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        if (res.ok) {
          setFormResponseId(responseId)
          setStage(3)
        } else {
          toast.error('Error submitting typeform, please contact support.', {
            duration: 10000,
          })
        }
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

  useEffect(() => {
    setCitizenData({
      name: nft?.metadata?.name,
      description: nft?.metadata?.description,
      location: getAttribute(nft.metadata.attributes, 'location').value,
      discord: getAttribute(nft.metadata.attributes, 'discord').value,
      twitter: getAttribute(nft.metadata.attributes, 'twitter').value,
      website: getAttribute(nft.metadata.attributes, 'website').value,
      view: 'public',
    })
  }, [nft])

  return (
    <Modal id="citizen-metadata-modal-backdrop" setEnabled={setEnabled}>
      <div className="flex flex-col gap-2 items-start justify-start w-[100vw] md:w-[650px] p-5 bg-gradient-to-b from-dark-cool to-darkest-cool rounded-[2vmax] h-screen md:h-auto">
        <div className="w-full flex items-center justify-between">
          <h1 className="text-2xl font-GoodTimes">Update Info</h1>
          <button
            id="close-modal"
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
            <p>Would you like to update your email?</p>
            <div className="flex gap-4">
              <button
                className="px-5 py-2 rounded-md gradient-2"
                onClick={() => setStage(2)}
              >
                Yes
              </button>
              <button
                className="px-5 py-2 rounded-md border-2 border-light-warm border-gradient-2"
                onClick={() => setStage(3)}
              >
                No
              </button>
            </div>
          </>
        )}
        {stage === 2 && (
          <Widget
            className="w-[100%] md:w-[100%]"
            id={
              process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID as string
            }
            onSubmit={submitTypeform}
            height={500}
          />
        )}
        {stage === 3 && (
          <>
            <CitizenMetadataForm
              nft={nft}
              citizenData={citizenData}
              setCitizenData={setCitizenData}
            />
            <PrivyWeb3Button
              className="mt-4 w-full gradient-2 rounded-[5vmax]"
              requiredChain={DEFAULT_CHAIN}
              label="Submit"
              action={async () => {
                if (
                  !citizenData.name ||
                  citizenData.name.trim() === '' ||
                  !citizenData.description ||
                  citizenData.description.trim() === ''
                ) {
                  return toast.error('Please enter a name and bio.')
                }

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

                  const oldFormResponseId = getAttribute(
                    nft?.metadata?.attributes,
                    'formId'
                  )
                  if (oldFormResponseId !== formResponseId) {
                    //delete old typeform response
                    await deleteResponse(
                      process.env
                        .NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
                      oldFormResponseId
                    )
                  }

                  const cleanedCitizenData = cleanData(citizenData)

                  const tx = await citizenTableContract?.call('updateTable', [
                    nft.metadata.id,
                    cleanedCitizenData.name,
                    cleanedCitizenData.description,
                    imageIpfsLink,
                    cleanedCitizenData.location,
                    cleanedCitizenData.discord,
                    cleanedCitizenData.twitter,
                    cleanedCitizenData.website,
                    cleanedCitizenData.view,
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
          </>
        )}
      </div>
    </Modal>
  )
}
