import { XMarkIcon } from '@heroicons/react/24/outline'
import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { Widget } from '@typeform/embed-react'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import { CITIZEN_TABLE_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { unpin } from '@/lib/ipfs/unpin'
import cleanData from '@/lib/tableland/cleanData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import deleteResponse from '@/lib/typeform/deleteResponse'
import waitForResponse from '@/lib/typeform/waitForResponse'
import { renameFile } from '@/lib/utils/files'
import { getAttribute } from '@/lib/utils/nft'
import { addHttpsIfMissing } from '@/lib/utils/strings'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import FormInput from '../forms/FormInput'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import Modal from '../layout/Modal'
import { ImageGenerator } from '../onboarding/CitizenImageGenerator'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

let getMarkdown: GetMarkdown
let setMarkdown: SetMarkdown

const NanceEditor = dynamic(
  async () => {
    getMarkdown = (await import('@nance/nance-editor')).getMarkdown
    setMarkdown = (await import('@nance/nance-editor')).setMarkdown
    return import('@nance/nance-editor').then((mod) => mod.NanceEditor)
  },
  {
    ssr: false,
    loading: () => <LoadingSpinner />,
  }
)

function MissionMetadataForm({ missionData, setMissionData }: any) {
  const [stage, setStage] = useState(0)
  return (
    <div className="w-full flex flex-col gap-2">
      {stage === 0 && (
       
      )}
      {stage === 1 && (
        <>
          <NanceEditor
            initialValue={missionData?.description}
            fileUploadExternal={async (val) => {
              const res = await pinBlobOrFile(val)
              return res.url
            }}
            darkMode={true}
            onEditorChange={(m: string) => {
              setMissionData((prev: any) => ({ ...prev, description: m }))
            }}
          />
        </>
      )}
    </div>
  )
}

export default function MissionMetadataModal({
  mission,
  selectedChain,
  setEnabled,
}: any) {
  const account = useActiveAccount()
  const router = useRouter()

  const [stage, setStage] = useState(0)
  const [inputImage, setInputImage] = useState<File>()
  const [currMissionImage, setCurrMissionImage] = useState<string>(
    mission?.metadata?.logoUri
  )
  const [newMissionImage, setNewMissionImage] = useState<File>()
  const [missionData, setMissionData] = useState<any>()

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
          <></>
        )}
        {stage == 0 && (
           <>
          <FormInput
            id="citizen-name-input"
            label="Name *"
            value={missionData?.name}
            onChange={({ target }: any) =>
              setMissionData((prev: any) => ({ ...prev, name: target.value }))
            }
            placeholder="Enter your mission name"
            maxLength={100}
          />
          <FormInput
            id="citizen-bio-input"
            label="Bio"
            value={missionData?.description}
            onChange={({ target }: any) =>
              setMissionData((prev: any) => ({
                ...prev,
                description: target.value,
              }))
            }
            placeholder="Enter your bio"
            maxLength={1024}
          />
        </>
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
            <ConditionCheckbox
              label="I acknowledge that this info will be stored permanently onchain."
              agreedToCondition={agreedToOnChainData}
              setAgreedToCondition={setAgreedToOnChainData}
            />
            <PrivyWeb3Button
              v5
              className="mt-4 w-full gradient-2 rounded-[5vmax]"
              requiredChain={DEFAULT_CHAIN_V5}
              label="Submit"
              isDisabled={!agreedToOnChainData}
              action={async () => {
                if (!account) return
                if (!citizenData.name || citizenData.name.trim() === '') {
                  return toast.error('Please enter a name.')
                }

                try {
                  let imageIpfsLink
                  const currCitizenImage = nft.metadata.image || ''

                  if (
                    !newCitizenImage &&
                    currCitizenImage &&
                    currCitizenImage !== ''
                  ) {
                    imageIpfsLink = currCitizenImage
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
                    await unpin(currCitizenImage.split('ipfs://')[1])

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

                  //get location data from google's geocoder
                  const locationDataRes = await fetch('/api/google/geocoder', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      location: cleanedCitizenData.location,
                    }),
                  })
                  const { data: locationData } = await locationDataRes.json()
                  const locationLat =
                    locationData?.results?.[0]?.geometry?.location?.lat || -90
                  const locationLng =
                    locationData?.results?.[0]?.geometry?.location?.lng || 0
                  const locationName =
                    locationData?.results?.[0]?.formatted_address ||
                    'Antarctica'
                  const citizenLocationData = {
                    lat: locationLat,
                    lng: locationLng,
                    name: locationName,
                  }
                  const cleanedLocationData = cleanData(citizenLocationData)

                  const formattedCitizenTwitter = cleanedCitizenData.twitter
                    ? addHttpsIfMissing(cleanedCitizenData.twitter)
                    : ''
                  const formattedCitizenWebsite = cleanedCitizenData.website
                    ? addHttpsIfMissing(cleanedCitizenData.website)
                    : ''
                  const formattedCitizenDiscord = cleanedCitizenData.discord
                    ? cleanedCitizenData.discord.startsWith('@')
                      ? cleanedCitizenData.discord.replace('@', '')
                      : cleanedCitizenData.discord
                    : ''

                  const transaction = prepareContractCall({
                    contract: citizenTableContract,
                    method: 'updateTableDynamic' as string,
                    params: [
                      nft.metadata.id,
                      [
                        'name',
                        'description',
                        'image',
                        'location',
                        'discord',
                        'twitter',
                        'website',
                        'view',
                        'formId',
                      ],
                      [
                        cleanedCitizenData.name,
                        cleanedCitizenData.description,
                        imageIpfsLink,
                        JSON.stringify(cleanedLocationData),
                        formattedCitizenDiscord,
                        formattedCitizenTwitter,
                        formattedCitizenWebsite,
                        cleanedCitizenData.view,
                        formResponseId,
                      ],
                    ],
                  })

                  const receipt = await sendAndConfirmTransaction({
                    transaction,
                    account,
                  })

                  setEnabled(false)

                  if (receipt) {
                    setTimeout(() => {
                      router.reload()
                    }, 30000)
                  }
                } catch (err) {
                  console.log(err)
                }
              }}
            />
          </>
        )}
      </div>
    </Modal>
  )
}
