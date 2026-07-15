import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { getAccessToken } from '@privy-io/react-auth'
import { Widget } from '@typeform/embed-react'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import { CITIZEN_TABLE_ADDRESSES, CITIZEN_TABLE_NAMES, DEFAULT_CHAIN_V5 } from 'const/config'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { unpinCitizenImage } from '@/lib/ipfs/unpin'
import {
  formatCitizenLocationForTable,
  sanitizeTablelandField,
  unescapeQuotes,
} from '@/lib/tableland/cleanData'
import { waitForRow } from '@/lib/tableland/waitForRow'
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
        maxLength={
          bytesOfString(citizenData?.instagram) >= 1024 ? citizenData?.instagram.length : 1024
        }
        formatNumbers={false}
      />
      <Input
        id="citizen-linkedin-input"
        label="LinkedIn"
        value={citizenData?.linkedin}
        onChange={(e) => setCitizenData((prev: any) => ({ ...prev, linkedin: e.target.value }))}
        placeholder="Enter your LinkedIn link including https://"
        maxLength={
          bytesOfString(citizenData?.linkedin) >= 1024 ? citizenData?.linkedin.length : 1024
        }
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
  // The user's cropped upload, lifted from the image generator. Used as the
  // saved image when the user uploads a photo but never generates an AI
  // portrait, so they don't have to click "Use my photo" first.
  const [croppedInputImage, setCroppedInputImage] = useState<File>()
  const [citizenData, setCitizenData] = useState<any>()
  const [formResponseId, setFormResponseId] = useState<string>(
    getAttribute(nft?.metadata?.attributes, 'formId')?.value ?? '',
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
    [citizenTableContract],
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
        view: (getAttribute(nft.metadata.attributes, 'view').value || 'public') as
          | 'public'
          | 'private',
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
            onCrop={setCroppedInputImage}
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
            <div
              data-testid="email-update-section"
              className="mt-3 w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden relative"
            >
              <div className="min-h-[500px] max-h-[60vh] typeform-widget-container">
                {process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID ? (
                  <Widget
                    className="w-full"
                    id={process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID}
                    onSubmit={submitTypeform}
                    height={500}
                  />
                ) : (
                  <p className="text-sm text-gray-400 p-4">Email update form is not available.</p>
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
              // Prefer a generated AI portrait, otherwise fall back to the
              // user's cropped upload so an uploaded photo is saved even when
              // no AI image was generated.
              const chosenImage = newCitizenImage || croppedInputImage

              if (!chosenImage && currCitizenImage && currCitizenImage !== '') {
                imageIpfsLink = currCitizenImage
              } else {
                if (!chosenImage) return console.error('No new image')

                const renamedCitizenImage = renameFile(
                  chosenImage,
                  `${citizenData?.name} Citizen Image`,
                )

                const { cid: newImageIpfsHash } = await pinBlobOrFile(renamedCitizenImage)

                // Unpin the old image best-effort — a failure here must not
                // block the profile update. The type mismatch between the
                // numeric token ID and the string the API checks caused every
                // unpin to return 401 and abort the entire update.
                unpinCitizenImage(nft.metadata.id).catch((err) =>
                  console.warn('Failed to unpin old citizen image (non-blocking):', err)
                )

                imageIpfsLink = `ipfs://${newImageIpfsHash}`
              }

              const oldFormResponseId = getAttribute(nft?.metadata?.attributes, 'formId')?.value

              if (oldFormResponseId !== formResponseId) {
                await deleteResponse(
                  process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
                  oldFormResponseId,
                )
              }

              // Geocode from raw user input — cleanData must run only when
              // building the on-chain payload. Escaping before geocoding can
              // double-escape location names and produce malformed SQL.
              let locationForTable = ''
              const rawLocation = citizenData.location?.trim() ?? ''
              if (rawLocation !== '') {
                const locationDataRes = await fetch('/api/google/geocoder', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    location: rawLocation,
                  }),
                })
                const { data: locationData } = await locationDataRes.json()
                const geocodedResult = locationData?.results?.[0]
                if (geocodedResult) {
                  locationForTable = formatCitizenLocationForTable(
                    geocodedResult.geometry.location.lat,
                    geocodedResult.geometry.location.lng,
                    geocodedResult.formatted_address,
                  )
                } else {
                  locationForTable = formatCitizenLocationForTable(0, 0, rawLocation)
                }
              }

              const cleanedName = sanitizeTablelandField(citizenData.name)
              const cleanedDescription = sanitizeTablelandField(citizenData.description ?? '')
              const cleanedView = sanitizeTablelandField(citizenData.view ?? 'public')

              const formattedCitizenTwitter = citizenData.twitter?.trim()
                ? sanitizeTablelandField(addHttpsIfMissing(citizenData.twitter.trim()))
                : ''
              const formattedCitizenInstagram = citizenData.instagram?.trim()
                ? sanitizeTablelandField(addHttpsIfMissing(citizenData.instagram.trim()))
                : ''
              const formattedCitizenLinkedin = citizenData.linkedin?.trim()
                ? sanitizeTablelandField(addHttpsIfMissing(citizenData.linkedin.trim()))
                : ''
              const formattedCitizenWebsite = citizenData.website?.trim()
                ? sanitizeTablelandField(addHttpsIfMissing(citizenData.website.trim()))
                : ''
              const rawDiscord = citizenData.discord?.trim()
                ? citizenData.discord.startsWith('@')
                  ? citizenData.discord.replace('@', '')
                  : citizenData.discord
                : ''
              const formattedCitizenDiscord = rawDiscord
                ? sanitizeTablelandField(rawDiscord)
                : ''
              const formIdForTable = sanitizeTablelandField(formResponseId)

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
                    cleanedName,
                    cleanedDescription,
                    imageIpfsLink,
                    locationForTable,
                    formattedCitizenDiscord,
                    formattedCitizenTwitter,
                    formattedCitizenWebsite,
                    formattedCitizenInstagram,
                    formattedCitizenLinkedin,
                    cleanedView,
                    formIdForTable,
                  ],
                ],
              })

              const receipt = await sendAndConfirmTransaction({
                transaction,
                account,
              })

              if (receipt) {
                toast.success('Profile Edited Successfully')
                setEnabled(false)
                // Wait until the new data is indexed by Tableland, then refresh
                // the profile so the user sees their updated image/details
                // rather than the stale version.
                const tableName = CITIZEN_TABLE_NAMES[getChainSlug(selectedChain)]
                const statement = `SELECT id, name, description, image FROM ${tableName} WHERE id = ${nft.metadata.id}`
                const expectedName = unescapeQuotes(cleanedName)
                const expectedDescription = unescapeQuotes(cleanedDescription)
                await waitForRow({
                  statement,
                  checkCondition: (rows) => {
                    const row = Array.isArray(rows) ? rows[0] : undefined
                    return (
                      !!row &&
                      row.image === imageIpfsLink &&
                      row.name === expectedName &&
                      (row.description ?? '') === expectedDescription
                    )
                  },
                  pollInterval: 3000,
                  maxRetries: 20,
                  cacheBusting: true,
                })
                router.reload()
              }
            } catch (err: any) {
              console.error('Profile update failed:', err)
              const message = err?.message ?? ''
              if (
                message.includes('gas required exceeds allowance') ||
                message.includes('execution reverted')
              ) {
                toast.error(
                  'Profile update failed — this usually means a name, bio, or location value contains an apostrophe or special character that broke the on-chain update. Try removing quotes/apostrophes and submit again.',
                  { duration: 12000 },
                )
              } else {
                toast.error('Something went wrong updating your profile. Please try again.')
              }
            }
          }}
        />

        {/* Danger Zone */}
        <div className="w-full pt-6 mt-2 border-t border-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-2">
            Danger Zone
          </h3>

          {/* Profile visibility */}
          <div className="mb-6">
            <p className="text-gray-400 text-xs mb-3 leading-relaxed">
              Control whether your profile is visible to other MoonDAO members.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCitizenData((prev: any) => ({ ...prev, view: 'public' }))}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
                  citizenData?.view === 'public' || !citizenData?.view
                    ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                }`}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => setCitizenData((prev: any) => ({ ...prev, view: 'private' }))}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
                  citizenData?.view === 'private'
                    ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                }`}
              >
                Private
              </button>
            </div>
          </div>

          <p className="text-gray-400 text-xs mb-4 leading-relaxed">
            Deleting your profile data is permanent and cannot be undone. All information —
            including your name, bio, image, and social links — will be erased from the blockchain.
            Your citizen NFT will remain, but your profile will be blank.
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
