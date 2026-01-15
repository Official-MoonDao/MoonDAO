import { getAccessToken } from '@privy-io/react-auth'
import { Widget } from '@typeform/embed-react'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import { CITIZEN_TABLE_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { unpinCitizenImage } from '@/lib/ipfs/unpin'
import cleanData from '@/lib/tableland/cleanData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import deleteResponse from '@/lib/typeform/deleteResponse'
import waitForResponse from '@/lib/typeform/waitForResponse'
import { renameFile } from '@/lib/utils/files'
import { getAttribute } from '@/lib/utils/nft'
import { addHttpsIfMissing, bytesOfString } from '@/lib/utils/strings'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import Input from '../layout/Input'
import Modal from '../layout/Modal'
import { ImageGenerator } from '../onboarding/CitizenImageGenerator'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import DeleteProfileData from './DeleteProfileData'

function CitizenMetadataForm({ citizenData, setCitizenData }: any) {
  return (
    <div className="w-full flex flex-col gap-2">
      <Input
        id="citizen-name-input"
        label="Name *"
        value={citizenData?.name}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, name: e.target.value }))}
        placeholder="Enter your name"
        maxLength={100}
      />
      <Input
        id="citizen-bio-input"
        label="Bio"
        value={citizenData?.description}
        onChange={(e) =>
          setCitizenData((prev: any) => ({
            ...prev,
            description: e.target.value,
          }))
        }
        placeholder="Enter your bio"
        maxLength={
          bytesOfString(citizenData?.description) >= 1024 ? citizenData?.description.length : 1024
        }
      />
      <Input
        id="citizen-location-input"
        label="Location"
        value={citizenData?.location}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, location: e.target.value }))}
        placeholder="Enter your city and/or country"
        maxLength={
          bytesOfString(citizenData?.location) >= 1024 ? citizenData?.location.length : 1024
        }
      />
      <Input
        id="citizen-discord-input"
        label="Discord"
        value={citizenData?.discord}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, discord: e.target.value }))}
        placeholder="Enter your discord username"
        maxLength={bytesOfString(citizenData?.discord) >= 1024 ? citizenData?.discord.length : 1024}
      />
      <Input
        id="citizen-twitter-input"
        label="X/Twitter"
        value={citizenData?.twitter}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, twitter: e.target.value }))}
        placeholder="Enter your Twitter link including https://"
        maxLength={bytesOfString(citizenData?.twitter) >= 1024 ? citizenData?.twitter.length : 1024}
      />
      <Input
        id="citizen-instagram-input"
        label="Instagram"
        value={citizenData?.instagram}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, instagram: e.target.value }))}
        placeholder="Enter your Instagram link including https://"
        maxLength={bytesOfString(citizenData?.instagram) >= 1024 ? citizenData?.instagram.length : 1024}
      />
      <Input
        id="citizen-linkedin-input"
        label="LinkedIn"
        value={citizenData?.linkedin}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, linkedin: e.target.value }))}
        placeholder="Enter your LinkedIn link including https://"
        maxLength={bytesOfString(citizenData?.linkedin) >= 1024 ? citizenData?.linkedin.length : 1024}
      />
      <Input
        id="citizen-website-input"
        label="Website"
        value={citizenData?.website}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, website: e.target.value }))}
        placeholder="Enter your website link including https://"
        maxLength={bytesOfString(citizenData?.website) >= 1024 ? citizenData?.website.length : 1024}
      />
    </div>
  )
}

export default function CitizenMetadataModal({ nft, selectedChain, setEnabled }: any) {
  const account = useActiveAccount()
  const router = useRouter()

  const [stage, setStage] = useState(0)
  const [inputImage, setInputImage] = useState<File>()
  const [currCitizenImage, setCurrCitizenImage] = useState<string>(nft?.metadata?.image)
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

        const accessToken = await getAccessToken()

        const res = await fetch(`/api/typeform/response`, {
          method: 'POST',
          body: JSON.stringify({
            accessToken: accessToken,
            responseId: responseId,
            formId: formId,
          }),
        })

        if (res.ok) {
          setFormResponseId(responseId)
          setStage(4)
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
      const citizenLocation = getAttribute(nft.metadata.attributes, 'location').value

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
        instagram: getAttribute(nft.metadata.attributes, 'instagram').value,
        linkedin: getAttribute(nft.metadata.attributes, 'linkedin').value,
        view: 'public',
      }
    })
  }, [nft])

  return (
    <Modal
      id="citizen-metadata-modal-backdrop"
      setEnabled={setEnabled}
      title="Edit Profile"
      size="3xl"
    >
      <div className="flex flex-col gap-6 items-start justify-start">
        {stage === 0 && (
          <>
            <div className="w-full">
              <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
              <CitizenMetadataForm
                nft={nft}
                citizenData={citizenData}
                setCitizenData={setCitizenData}
              />
            </div>
            <div className="flex gap-4 mt-6 w-full">
              <button
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200 flex-1"
                onClick={() => setStage(1)}
              >
                Next: Update Profile Picture
              </button>
            </div>
          </>
        )}
        {stage === 1 && (
          <ImageGenerator
            image={newCitizenImage}
            setImage={setNewCitizenImage}
            inputImage={inputImage}
            setInputImage={setInputImage}
            nextStage={() => setStage(2)}
            stage={stage}
            currImage={currCitizenImage}
          />
        )}
        {stage === 1 && (
          <DeleteProfileData
            nft={nft}
            setEnabled={setEnabled}
            tableContract={citizenTableContract}
            tokenId={nft.metadata.id}
            type="citizen"
          />
        )}
        {stage === 2 && (
          <>
            <div className="text-center mb-6 w-full">
              <h3 className="text-xl font-semibold text-white mb-3">Almost Done!</h3>
              <p className="text-white/70">
                Would you like to update your email for notifications?
              </p>
            </div>
            <div className="flex gap-4 w-full">
              <button
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-200 flex-1"
                onClick={() => setStage(3)}
              >
                Yes, Update Email
              </button>
              <button
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 flex-1 border border-white/20"
                onClick={() => setStage(4)}
              >
                Skip for Now
              </button>
            </div>
          </>
        )}
        {stage === 3 && (
          <div className="w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Update Email</h3>
            <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden relative">
              <div className="min-h-[500px] max-h-[60vh] typeform-widget-container">
                <Widget
                  className="w-full"
                  id={process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID as string}
                  onSubmit={submitTypeform}
                  height={500}
                />
              </div>
              {/* Visible indicator for scroll/navigation */}
              <div className="absolute bottom-4 right-4 bg-blue-600/90 text-white text-xs px-3 py-2 rounded-lg backdrop-blur-sm border border-blue-400/30 shadow-lg pointer-events-none">
                ↕️ Scroll for more
              </div>
            </div>
          </div>
        )}
        {stage === 4 && (
          <>
            <div className="w-full">
              <h2 className="text-lg font-semibold text-white mb-4">Review & Submit</h2>
              <CitizenMetadataForm
                nft={nft}
                citizenData={citizenData}
                setCitizenData={setCitizenData}
              />
            </div>
            <div className="w-full">
              <ConditionCheckbox
                label="I acknowledge that this info will be stored permanently onchain."
                agreedToCondition={agreedToOnChainData}
                setAgreedToCondition={setAgreedToOnChainData}
              />
            </div>
            <PrivyWeb3Button
              v5
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              requiredChain={DEFAULT_CHAIN_V5}
              label="Update Profile"
              isDisabled={!agreedToOnChainData}
              action={async () => {
                if (!account) return
                if (!citizenData.name || citizenData.name.trim() === '') {
                  return toast.error('Please enter a name.')
                }

                try {
                  let imageIpfsLink
                  const currCitizenImage = nft.metadata.image || ''

                  if (!newCitizenImage && currCitizenImage && currCitizenImage !== '') {
                    imageIpfsLink = currCitizenImage
                  } else {
                    if (!newCitizenImage) return console.error('No new image')

                    const renamedCitizenImage = renameFile(
                      newCitizenImage,
                      `${citizenData?.name} Citizen Image`
                    )

                    //pin new image
                    const { cid: newImageIpfsHash } = await pinBlobOrFile(renamedCitizenImage)

                    //unpin old image
                    await unpinCitizenImage(nft.metadata.id)

                    imageIpfsLink = `ipfs://${newImageIpfsHash}`
                  }

                  const oldFormResponseId = getAttribute(nft?.metadata?.attributes, 'formId')?.value

                  if (oldFormResponseId !== formResponseId) {
                    //delete old typeform response
                    await deleteResponse(
                      process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
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
                  const locationLat = locationData?.results?.[0]?.geometry?.location?.lat || -90
                  const locationLng = locationData?.results?.[0]?.geometry?.location?.lng || 0
                  const locationName = locationData?.results?.[0]?.formatted_address || 'Antarctica'
                  const citizenLocationData = {
                    lat: locationLat,
                    lng: locationLng,
                    name: locationName,
                  }
                  const cleanedLocationData = cleanData(citizenLocationData)

                  const formattedCitizenTwitter = cleanedCitizenData.twitter
                    ? addHttpsIfMissing(cleanedCitizenData.twitter)
                    : ''
                  const formattedCitizenInstagram = cleanedCitizenData.instagram
                    ? addHttpsIfMissing(cleanedCitizenData.instagram)
                    : ''
                  const formattedCitizenLinkedin = cleanedCitizenData.linkedin
                    ? addHttpsIfMissing(cleanedCitizenData.linkedin)
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
                        'instagram',
                        'linkedin',
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
                        formattedCitizenInstagram,
                        formattedCitizenLinkedin,
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
