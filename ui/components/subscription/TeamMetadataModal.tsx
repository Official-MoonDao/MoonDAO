import { getAccessToken } from '@privy-io/react-auth'
import { Widget } from '@typeform/embed-react'
import TeamTableABI from 'const/abis/TeamTable.json'
import { DEFAULT_CHAIN_V5, TEAM_TABLE_ADDRESSES } from 'const/config'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { unpin, unpinTeamImage } from '@/lib/ipfs/unpin'
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
import { ImageGenerator } from '../onboarding/TeamImageGenerator'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import DeleteProfileData from './DeleteProfileData'

function TeamMetadataForm({ teamData, setTeamData }: any) {
  return (
    <div className="w-full flex flex-col gap-4">
      <Input
        id="team-name-input"
        label="Team Name *"
        value={teamData.name}
        onChange={(e) => setTeamData((prev: any) => ({ ...prev, name: e.target.value }))}
        placeholder="Enter your team name"
        maxLength={100}
        variant="modern"
      />
      <Input
        id="team-bio-input"
        label="Bio"
        value={teamData.description}
        onChange={(e) => setTeamData((prev: any) => ({ ...prev, description: e.target.value }))}
        placeholder="Tell us about your team"
        maxLength={bytesOfString(teamData.description) >= 1024 ? teamData.description.length : 1024}
        variant="modern"
      />
      <Input
        id="team-twitter-input"
        label="Twitter"
        value={teamData.twitter}
        onChange={(e) => setTeamData((prev: any) => ({ ...prev, twitter: e.target.value }))}
        placeholder="Twitter profile or handle"
        maxLength={bytesOfString(teamData.twitter) >= 1024 ? teamData.twitter.length : 1024}
        variant="modern"
      />
      <Input
        id="team-communications-input"
        label="Communications"
        value={teamData.communications}
        onChange={(e) =>
          setTeamData((prev: any) => ({
            ...prev,
            communications: e.target.value,
          }))
        }
        placeholder="Discord, Slack, or other communication link"
        maxLength={
          bytesOfString(teamData.communications) >= 1024 ? teamData.communications.length : 1024
        }
        variant="modern"
      />
      <Input
        id="team-website-input"
        label="Website"
        value={teamData.website}
        onChange={(e) => setTeamData((prev: any) => ({ ...prev, website: e.target.value }))}
        placeholder="Team website URL"
        maxLength={bytesOfString(teamData.website) >= 1024 ? teamData.website.length : 1024}
        variant="modern"
      />
    </div>
  )
}

export default function TeamMetadataModal({ account, nft, selectedChain, setEnabled }: any) {
  const router = useRouter()

  const [stage, setStage] = useState(0)

  const [currTeamImage, setCurrTeamImage] = useState<string>(nft?.metadata?.image)
  const [newTeamImage, setNewTeamImage] = useState<File>()
  const [teamData, setTeamData] = useState<any>()
  const [formResponseId, setFormResponseId] = useState<string>(
    getAttribute(nft?.metadata?.attributes, 'formId').value
  )
  const [agreedToOnChainData, setAgreedToOnChainData] = useState(false)

  const teamTableContract = useContract({
    address: TEAM_TABLE_ADDRESSES[getChainSlug(selectedChain)],
    chain: selectedChain,
    abi: TeamTableABI,
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
    [teamTableContract, newTeamImage]
  )

  useEffect(() => {
    setTeamData({
      name: nft?.metadata?.name,
      description: nft?.metadata?.description,
      twitter: getAttribute(nft.metadata.attributes, 'twitter')?.value,
      communications: getAttribute(nft.metadata.attributes, 'communications')?.value,
      website: getAttribute(nft.metadata.attributes, 'website')?.value,
      view: 'public',
    })
  }, [nft])

  return (
    <Modal
      id="entity-metadata-modal-backdrop"
      setEnabled={setEnabled}
      title="Update Team Info"
      size="3xl"
    >
      <div className="flex flex-col gap-6 items-start justify-start">
        <p className="text-slate-300 text-sm -mt-4">Manage your team profile and settings</p>
        {stage === 0 && (
          <div className="w-full bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-2xl border border-slate-600/30 p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-white">Team Image</h3>
                <p className="text-slate-300 text-sm">Upload or update your team image</p>
              </div>
              <ImageGenerator
                setImage={setNewTeamImage}
                nextStage={() => setStage(1)}
                stage={stage}
                currImage={currTeamImage}
              />
            </div>
          </div>
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
          <div className="w-full bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-2xl border border-slate-600/30 p-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-white">Email Update</h3>
                <p className="text-slate-300">
                  {"Would you like to update your team's email address?"}
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  className="px-6 py-3 rounded-2xl gradient-2 hover:scale-105 transition-transform font-medium text-white"
                  onClick={() => setStage(2)}
                >
                  Yes, update email
                </button>
                <button
                  className="px-6 py-3 rounded-2xl border-2 border-slate-600 hover:border-slate-400 transition-colors text-white font-medium"
                  onClick={() => setStage(3)}
                >
                  No, skip this step
                </button>
              </div>
            </div>
          </div>
        )}
        {stage === 2 && (
          <div className="w-full bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-2xl border border-slate-600/30 overflow-hidden">
            <div className="p-6 border-b border-slate-600/30">
              <h3 className="text-lg font-semibold text-white">Update Email</h3>
              <p className="text-slate-300 text-sm">
                Please fill out the form below to update your email
              </p>
            </div>
            <div className="relative">
              <div className="min-h-[500px] max-h-[60vh] typeform-widget-container">
                <Widget
                  className="w-full"
                  id={process.env.NEXT_PUBLIC_TYPEFORM_TEAM_EMAIL_FORM_ID as string}
                  onSubmit={submitTypeform}
                  height={500}
                />
              </div>
              {/* Visible indicator for scroll/navigation */}
              <div className="absolute bottom-4 right-4 bg-blue-600/80 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm border border-blue-400/30 shadow-lg pointer-events-none opacity-75 scroll-indicator">
                ↕️ Scroll for more
              </div>
            </div>
          </div>
        )}
        {stage === 3 && (
          <div className="w-full bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-2xl border border-slate-600/30 p-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-white">Team Information</h3>
                <p className="text-slate-300 text-sm">
                  Update your team details and contact information
                </p>
              </div>
              <TeamMetadataForm teamData={teamData} setTeamData={setTeamData} />
              <div className="border-t border-slate-600/30 pt-4">
                <ConditionCheckbox
                  label="I acknowledge that this info will be stored permanently onchain."
                  agreedToCondition={agreedToOnChainData}
                  setAgreedToCondition={setAgreedToOnChainData}
                />
              </div>
              <PrivyWeb3Button
                v5
                className="mt-4 w-full gradient-2 hover:scale-105 transition-transform rounded-2xl py-3 font-medium"
                requiredChain={DEFAULT_CHAIN_V5}
                label="Update Team Information"
                isDisabled={!agreedToOnChainData}
                action={async () => {
                  if (!teamData.name || teamData.name.trim() === '') {
                    return toast.error('Please enter a name.')
                  }

                  try {
                    let imageIpfsLink

                    if (!newTeamImage && currTeamImage && currTeamImage !== '') {
                      imageIpfsLink = currTeamImage
                    } else {
                      if (!newTeamImage) return console.error('No new image')

                      const renamedTeamImage = renameFile(
                        newTeamImage,
                        `${teamData?.name} Team Image`
                      )

                      //pin new image
                      const { cid: newImageIpfsHash } = await pinBlobOrFile(renamedTeamImage)

                      //unpin old iamge
                      await unpinTeamImage(nft.metadata.id)

                      imageIpfsLink = `ipfs://${newImageIpfsHash}`
                    }

                    const oldFormResponseId = getAttribute(nft.metadata.attributes, 'formId').value

                    if (oldFormResponseId !== formResponseId) {
                      //delete old typeform response
                      await deleteResponse(
                        process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
                        oldFormResponseId
                      )
                    }

                    const cleanedTeamData = cleanData(teamData)

                    const formattedTeamTwitter = cleanedTeamData.twitter
                      ? addHttpsIfMissing(cleanedTeamData.twitter)
                      : ''
                    const formattedTeamCommunications = cleanedTeamData.communications
                      ? addHttpsIfMissing(cleanedTeamData.communications)
                      : ''
                    const formattedTeamWebsite = cleanedTeamData.website
                      ? addHttpsIfMissing(cleanedTeamData.website)
                      : ''

                    const transaction = prepareContractCall({
                      contract: teamTableContract,
                      method: 'updateTableDynamic' as string,
                      params: [
                        nft.metadata.id,
                        [
                          'name',
                          'description',
                          'image',
                          'twitter',
                          'communications',
                          'website',
                          'view',
                          'formId',
                        ],
                        [
                          cleanedTeamData.name,
                          cleanedTeamData.description,
                          imageIpfsLink,
                          formattedTeamTwitter,
                          formattedTeamCommunications,
                          formattedTeamWebsite,
                          cleanedTeamData.view,
                          formResponseId,
                        ],
                      ],
                    })

                    const receipt = await sendAndConfirmTransaction({
                      transaction,
                      account,
                    })

                    if (receipt) {
                      setTimeout(() => {
                        setEnabled(false)
                        router.reload()
                      }, 30000)
                    }
                  } catch (err) {
                    console.log(err)
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
