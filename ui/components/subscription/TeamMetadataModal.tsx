import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import { useContract, useResolvedMediaType } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { DEFAULT_CHAIN, TEAM_TABLE_ADDRESSES } from 'const/config'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { unpin } from '@/lib/ipfs/unpin'
import cleanData from '@/lib/tableland/cleanData'
import deleteResponse from '@/lib/typeform/deleteResponse'
import waitForResponse from '@/lib/typeform/waitForResponse'
import { renameFile } from '@/lib/utils/files'
import { getAttribute } from '@/lib/utils/nft'
import FormInput from '../forms/FormInput'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import Modal from '../layout/Modal'
import { ImageGenerator } from '../onboarding/TeamImageGenerator'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import DeleteProfileData from './DeleteProfileData'

function TeamMetadataForm({ teamData, setTeamData }: any) {
  return (
    <div className="w-full flex flex-col gap-2">
      <FormInput
        id="team-name-input"
        label="Name *"
        value={teamData.name}
        onChange={({ target }: any) =>
          setTeamData((prev: any) => ({ ...prev, name: target.value }))
        }
        placeholder="Enter your name"
      />
      <FormInput
        id="team-bio-input"
        label="Bio"
        value={teamData.description}
        onChange={({ target }: any) =>
          setTeamData((prev: any) => ({ ...prev, description: target.value }))
        }
        placeholder="Enter your bio"
      />
      <FormInput
        id="team-twitter-input"
        label="X/Twitter"
        value={teamData.twitter}
        onChange={({ target }: any) =>
          setTeamData((prev: any) => ({ ...prev, twitter: target.value }))
        }
        placeholder="Enter your Twitter link including https://"
      />
      <FormInput
        id="team-communications-input"
        label="Communications"
        value={teamData.communications}
        onChange={({ target }: any) =>
          setTeamData((prev: any) => ({
            ...prev,
            communications: target.value,
          }))
        }
        placeholder="Enter your communications link including https://"
      />
      <FormInput
        id="team-website-input"
        label="Website"
        value={teamData.website}
        onChange={({ target }: any) =>
          setTeamData((prev: any) => ({ ...prev, website: target.value }))
        }
        placeholder="Enter your website link including https://"
      />
    </div>
  )
}

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
  const [formResponseId, setFormResponseId] = useState<string>(
    getAttribute(nft?.metadata?.attributes, 'formId').value
  )
  const [agreedToOnChainData, setAgreedToOnChainData] = useState(false)

  const { getAccessToken } = usePrivy()

  const resolvedMetadata = useResolvedMediaType(nft?.metadata?.uri)

  const { contract: teamTableContract } = useContract(
    TEAM_TABLE_ADDRESSES[selectedChain.slug]
  )

  const submitTypeform = useCallback(
    async (formResponse: any) => {
      try {
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

  useEffect(() => {
    setTeamData({
      name: nft?.metadata?.name,
      description: nft?.metadata?.description,
      twitter: getAttribute(nft.metadata.attributes, 'twitter').value,
      communications: getAttribute(nft.metadata.attributes, 'communications')
        .value,
      website: getAttribute(nft.metadata.attributes, 'website').value,
      view: 'public',
    })
  }, [nft])

  return (
    <Modal id="entity-metadata-modal-backdrop" setEnabled={setEnabled}>
      <div className="w-full flex flex-col gap-2 items-start justify-start w-[100vw] md:w-[650px] p-5 bg-gradient-to-b from-dark-cool to-darkest-cool rounded-[2vmax] h-screen md:h-auto">
        <div className="w-full flex items-center justify-between">
          <h1 className="text-2xl font-GoodTimes ">Update Info</h1>
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
          <>
            <p>{"Would you like to update your team's email?"}</p>
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
            id={process.env.NEXT_PUBLIC_TYPEFORM_TEAM_EMAIL_FORM_ID as string}
            onSubmit={submitTypeform}
            height={500}
          />
        )}
        {stage === 3 && (
          <>
            <TeamMetadataForm teamData={teamData} setTeamData={setTeamData} />
            <ConditionCheckbox
              label="I acknowledge that this info will be stored permanently onchain."
              agreedToCondition={agreedToOnChainData}
              setAgreedToCondition={setAgreedToOnChainData}
            />
            <PrivyWeb3Button
              className="mt-4 w-full gradient-2 rounded-[5vmax]"
              requiredChain={DEFAULT_CHAIN}
              label="Submit"
              isDisabled={!agreedToOnChainData}
              action={async () => {
                if (!teamData.name || teamData.name.trim() === '') {
                  return toast.error('Please enter a name.')
                }

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

                  const oldFormResponseId = getAttribute(
                    nft.metadata.attributes,
                    'formId'
                  ).value

                  if (oldFormResponseId !== formResponseId) {
                    //delete old typeform response
                    await deleteResponse(
                      process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
                      oldFormResponseId
                    )
                  }

                  const cleanedTeamData = cleanData(teamData)

                  //mint NFT to safe
                  await teamTableContract?.call('updateTable', [
                    nft.metadata.id,
                    cleanedTeamData.name,
                    cleanedTeamData.description,
                    imageIpfsLink,
                    cleanedTeamData.twitter,
                    cleanedTeamData.communications,
                    cleanedTeamData.website,
                    cleanedTeamData.view,
                    formResponseId,
                  ])

                  setEnabled(false)

                  setTimeout(() => {
                    router.reload()
                  }, 15000)
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
