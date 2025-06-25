import { XMarkIcon } from '@heroicons/react/24/outline'
import { Widget } from '@typeform/embed-react'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import { CITIZEN_TABLE_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
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
import { addHttpsIfMissing, bytesOfString } from '@/lib/utils/strings'
import FormInput from '../forms/FormInput'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import Modal from '../layout/Modal'
import { ImageGenerator } from '../onboarding/CitizenImageGenerator'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import DeleteProfileData from './DeleteProfileData'

function CitizenMetadataForm({ citizenData, setCitizenData }: any) {
  return (
    <div className="w-full flex flex-col gap-2">
      <FormInput
        id="citizen-name-input"
        label="Name *"
        value={citizenData?.name}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({ ...prev, name: target.value }))
        }
        placeholder="Enter your name"
        maxLength={100}
      />
      <FormInput
        id="citizen-bio-input"
        label="Bio"
        value={citizenData?.description}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({
            ...prev,
            description: target.value,
          }))
        }
        placeholder="Enter your bio"
        maxLength={
          bytesOfString(citizenData?.description) >= 1024
            ? citizenData?.description.length
            : 1024
        }
      />
      <FormInput
        id="citizen-location-input"
        label="Location"
        value={citizenData?.location}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({ ...prev, location: target.value }))
        }
        placeholder="Enter your city and/or country"
        maxLength={
          bytesOfString(citizenData?.location) >= 1024
            ? citizenData?.location.length
            : 1024
        }
      />
      <FormInput
        id="citizen-discord-input"
        label="Discord"
        value={citizenData?.discord}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({ ...prev, discord: target.value }))
        }
        placeholder="Enter your discord username"
        maxLength={
          bytesOfString(citizenData?.discord) >= 1024
            ? citizenData?.discord.length
            : 1024
        }
      />
      <FormInput
        id="citizen-twitter-input"
        label="X/Twitter"
        value={citizenData?.twitter}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({ ...prev, twitter: target.value }))
        }
        placeholder="Enter your Twitter link including https://"
        maxLength={
          bytesOfString(citizenData?.twitter) >= 1024
            ? citizenData?.twitter.length
            : 1024
        }
      />
      <FormInput
        id="citizen-website-input"
        label="Website"
        value={citizenData?.website}
        onChange={({ target }: any) =>
          setCitizenData((prev: any) => ({ ...prev, website: target.value }))
        }
        placeholder="Enter your website link including https://"
        maxLength={
          bytesOfString(citizenData?.website) >= 1024
            ? citizenData?.website.length
            : 1024
        }
      />
    </div>
  )
}

export default function CitizenMetadataModal({
  nft,
  selectedChain,
  setEnabled,
}: any) {
  const account = useActiveAccount()
  const router = useRouter()

  const [stage, setStage] = useState(0)
  const [inputImage, setInputImage] = useState<File>()
  const [currCitizenImage, setCurrCitizenImage] = useState<string>(
    nft?.metadata?.image
  )
  const [newCitizenImage, setNewCitizenImage] = useState<File>()
  const [citizenData, setCitizenData] = useState<any>()
  const [formResponseId, setFormResponseId] = useState<string>(
    getAttribute(nft?.metadata?.attributes, 'formId').value
  )
  const [agreedToOnChainData, setAgreedToOnChainData] = useState(false)

  const citizenTableContract = useContract({
    chain: selectedChain,
    address: CITIZEN_TABLE_ADDRESSES[getChainSlug(selectedChain)],
    abi: CitizenTableABI,
  })

  const submitTypeform = useCallback(
    async (formResponse: any) => {
      try {
        //get response from form
        const { formId, responseId } = formResponse

        await waitForResponse(formId, responseId)

        const res = await fetch(
          `/api/typeform/response?formId=${formId}&responseId=${responseId}`,
          {
            method: 'POST',
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
    },
    [citizenTableContract]
  )

  useEffect(() => {
    setCitizenData(() => {
      const citizenLocation = getAttribute(
        nft.metadata.attributes,
        'location'
      ).value

      let locationName
      if (citizenLocation.startsWith('{')) {
        locationName = JSON.parse(citizenLocation).name
      } else locationName = citizenLocation

      return {
        name: nft?.metadata?.name,
        description: nft?.metadata?.description,
        location: locationName,
        discord: getAttribute(nft.metadata.attributes, 'discord').value,
        twitter: getAttribute(nft.metadata.attributes, 'twitter').value,
        website: getAttribute(nft.metadata.attributes, 'website').value,
        view: 'public',
      }
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
          <div className="w-full bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-2xl border border-slate-600/30 overflow-hidden relative">
            <div className="min-h-[500px] max-h-[60vh] typeform-widget-container">
              <Widget
                className="w-full"
                id={
                  process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID as string
                }
                onSubmit={submitTypeform}
                height={500}
              />
            </div>
            {/* Visible indicator for scroll/navigation */}
            <div className="absolute bottom-4 right-4 bg-blue-600/80 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm border border-blue-400/30 shadow-lg pointer-events-none opacity-75 scroll-indicator">
              ↕️ Scroll for more
            </div>
          </div>
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
