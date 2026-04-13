import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
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
        formatNumbers={false}
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
        formatNumbers={false}
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
        formatNumbers={false}
      />
      <Input
        id="citizen-discord-input"
        label="Discord"
        value={citizenData?.discord}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, discord: e.target.value }))}
        placeholder="Enter your discord username"
        maxLength={bytesOfString(citizenData?.discord) >= 1024 ? citizenData?.discord.length : 1024}
        formatNumbers={false}
      />
      <Input
        id="citizen-twitter-input"
        label="X/Twitter"
        value={citizenData?.twitter}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, twitter: e.target.value }))}
        placeholder="Enter your Twitter link including https://"
        maxLength={bytesOfString(citizenData?.twitter) >= 1024 ? citizenData?.twitter.length : 1024}
        formatNumbers={false}
      />
      <Input
        id="citizen-instagram-input"
        label="Instagram"
        value={citizenData?.instagram}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, instagram: e.target.value }))}
        placeholder="Enter your Instagram link including https://"
        maxLength={bytesOfString(citizenData?.instagram) >= 1024 ? citizenData?.instagram.length : 1024}
        formatNumbers={false}
      />
      <Input
        id="citizen-linkedin-input"
        label="LinkedIn"
        value={citizenData?.linkedin}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, linkedin: e.target.value }))}
        placeholder="Enter your LinkedIn link including https://"
        maxLength={bytesOfString(citizenData?.linkedin) >= 1024 ? citizenData?.linkedin.length : 1024}
        formatNumbers={false}
      />
      <Input
        id="citizen-website-input"
        label="Website"
        value={citizenData?.website}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, website: e.target.value }))}
        placeholder="Enter your website link including https://"
        maxLength={bytesOfString(citizenData?.website) >= 1024 ? citizenData?.website.length : 1024}
        formatNumbers={false}
      />
    </div>
  )
}

export default function CitizenMetadataModal({ nft, selectedChain, setEnabled }: any) {
  const account = useActiveAccount()
  const router = useRouter()

  const [inputImage, setInputImage] = useState<File>()
  const [newCitizenImage, setNewCitizenImage] = useState<File>()
  const [citizenData, setCitizenData] = useState<any>()
  const [formResponseId, setFormResponseId] = useState<string>(
    getAttribute(nft?.metadata?.attributes, 'formId').value
  )
  const [agreedToOnChainData, setAgreedToOnChainData] = useState(false)
  const [showEmailUpdate, setShowEmailUpdate] = useState(false)

  const citizenTableContract = useContract({
    chain: selectedChain,
    address: CITIZEN_TABLE_ADDRESSES[getChainSlug(selectedChain)],
    abi: CitizenTableABI,
  })

  const submitTypeform = useCallback(
    async (formResponse: any) => {
      try {
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
          toast.success('Email updated successfully!')
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
  }, [nft?.metadata?.id])

  return (
    <Modal
      id="citizen-metadata-modal-backdrop"
      setEnabled={setEnabled}
      title="Edit Profile"
      size="3xl"
    >
      <div className="flex flex-col gap-8 items-start justify-start">
        {/* Profile Picture */}
        <div className="w-full">
          <h2 className="text-lg font-semibold text-white mb-4">Profile Picture</h2>
          <ImageGenerator
            image={newCitizenImage}
            setImage={setNewCitizenImage}
            inputImage={inputImage}
            setInputImage={setInputImage}
          />
        </div>

        {/* Basic Information */}
        <div className="w-full">
          <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
          <CitizenMetadataForm
            nft={nft}
            citizenData={citizenData}
            setCitizenData={setCitizenData}
          />
        </div>

        {/* Update Email (collapsible) */}
        <div className="w-full">
          <button
            onClick={() => setShowEmailUpdate(!showEmailUpdate)}
            className="flex items-center justify-between w-full text-left py-3 px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/[0.08] transition-colors"
          >
            <span className="text-sm font-medium text-white">Update Email</span>
            {showEmailUpdate ? (
              <ChevronUpIcon className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {showEmailUpdate && (
            <div data-testid="email-update-section" className="mt-3 w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden relative">
              <div className="min-h-[500px] max-h-[60vh] typeform-widget-container">
                {process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID ? (
                  <Widget
                    className="w-full"
                    id={process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID}
                    onSubmit={submitTypeform}
                    height={500}
                  />
                ) : (
                  <p className="text-sm text-gray-400 p-4">
                    Email update form is not available.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Acknowledgment + Submit */}
        <div className="w-full">
          <ConditionCheckbox
            label="I acknowledge that this info will be stored permanently onchain."
            agreedToCondition={agreedToOnChainData}
            setAgreedToCondition={setAgreedToOnChainData}
          />
        </div>
        <PrivyWeb3Button
          v5
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          requiredChain={DEFAULT_CHAIN_V5}
          label="Update Profile"
          isDisabled={!agreedToOnChainData}
          action={async () => {
            if (!account) return
            if (!citizenData?.name || citizenData.name.trim() === '') {
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

                const { cid: newImageIpfsHash } = await pinBlobOrFile(renamedCitizenImage)

                await unpinCitizenImage(nft.metadata.id)

                imageIpfsLink = `ipfs://${newImageIpfsHash}`
              }

              const oldFormResponseId = getAttribute(nft?.metadata?.attributes, 'formId')?.value

              if (oldFormResponseId !== formResponseId) {
                await deleteResponse(
                  process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
                  oldFormResponseId
                )
              }

              const cleanedCitizenData = cleanData(citizenData)

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

        {/* Danger Zone */}
        <div className="w-full pt-6 mt-2 border-t border-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-2">
            Danger Zone
          </h3>
          <p className="text-gray-400 text-xs mb-4 leading-relaxed">
            Deleting your profile data is permanent and cannot be undone. All information — including your name, bio, image, and social links — will be erased from the blockchain. Your citizen NFT will remain, but your profile will be blank.
          </p>
          <DeleteProfileData
            nft={nft}
            setEnabled={setEnabled}
            tableContract={citizenTableContract}
            tokenId={nft.metadata.id}
            type="citizen"
          />
        </div>
      </div>
    </Modal>
  )
}
