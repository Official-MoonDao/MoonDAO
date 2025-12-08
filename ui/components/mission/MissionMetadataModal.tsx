import { XMarkIcon } from '@heroicons/react/24/outline'
import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import JBV5ControllerABI from 'const/abis/JBV5Controller.json'
import TeamABI from 'const/abis/Team.json'
import { DEFAULT_CHAIN_V5, IPFS_GATEWAY, TEAM_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'
import { marked } from 'marked'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import useSafe from '@/lib/safe/useSafe'
import useSafeApiKit from '@/lib/safe/useSafeApiKit'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { renameFile } from '@/lib/utils/files'
import { isValidYouTubeUrl } from '@/lib/utils/links'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import FileInput from '../layout/FileInput'
import Input from '../layout/Input'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import Modal from '../layout/Modal'
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

interface MissionMetadataModalProps {
  mission: any
  teamNFT: any
  selectedChain: any
  setEnabled: (enabled: boolean) => void
  jbControllerContract: any
}

function MissionMetadataForm({ missionData, setMissionData }: any) {
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Input
          id="mission-name-input"
          label="Mission Name *"
          value={missionData?.name}
          onChange={(e) => setMissionData((prev: any) => ({ ...prev, name: e.target.value }))}
          placeholder="Enter mission name"
          maxLength={100}
          variant="dark"
        />
        <Input
          id="mission-tagline-input"
          label="Tagline *"
          value={missionData?.tagline}
          onChange={(e) => setMissionData((prev: any) => ({ ...prev, tagline: e.target.value }))}
          placeholder="Enter a compelling tagline"
          maxLength={100}
          variant="dark"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Input
          id="mission-website-input"
          label="Website"
          value={missionData?.infoUri}
          onChange={(e) => setMissionData((prev: any) => ({ ...prev, infoUri: e.target.value }))}
          placeholder="https://yourwebsite.com"
          maxLength={500}
          variant="dark"
        />
        <Input
          id="mission-social-input"
          label="Social Link"
          value={missionData?.socialLink}
          onChange={(e) =>
            setMissionData((prev: any) => ({
              ...prev,
              socialLink: e.target.value,
            }))
          }
          placeholder="https://discord.gg/... or https://t.me/..."
          maxLength={500}
          variant="dark"
        />
      </div>
      <Input
        id="mission-youtube-input"
        label="YouTube Video Link"
        value={missionData?.youtubeLink}
        onChange={(e) =>
          setMissionData((prev: any) => ({
            ...prev,
            youtubeLink: e.target.value,
          }))
        }
        placeholder="https://youtube.com/watch?v=..."
        maxLength={500}
        variant="dark"
      />
    </div>
  )
}

export default function MissionMetadataModal({
  mission,
  teamNFT,
  selectedChain,
  setEnabled,
  jbControllerContract,
}: MissionMetadataModalProps) {
  const account = useActiveAccount()
  const router = useRouter()

  const [stage, setStage] = useState(0)
  const [teamOwnerAddress, setTeamOwnerAddress] = useState<string>()
  const [transactionQueued, setTransactionQueued] = useState(false)
  const [safeTxHash, setSafeTxHash] = useState<string>()
  const [isVerifying, setIsVerifying] = useState(true)
  const [isSafeSigner, setIsSafeSigner] = useState(false)
  const [safeOwners, setSafeOwners] = useState<string[]>([])

  const [newMissionImage, setNewMissionImage] = useState<File>()
  const [missionLogoUri, setMissionLogoUri] = useState<string>(mission?.metadata?.logoUri || '')
  const [missionData, setMissionData] = useState<any>({
    name: mission?.metadata?.name || '',
    tagline: mission?.metadata?.tagline || '',
    description: mission?.metadata?.description || '',
    infoUri: mission?.metadata?.infoUri || '',
    socialLink: mission?.metadata?.socialLink || '',
    youtubeLink: mission?.metadata?.youtubeLink || '',
  })

  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const chainSlug = getChainSlug(selectedChain)
  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
    chain: selectedChain,
  })

  // Get team owner address (Safe address) for queueing transactions
  useEffect(() => {
    async function getTeamOwner() {
      if (!teamNFT?.metadata?.id || !teamContract) return

      try {
        const owner: any = await readContract({
          contract: teamContract,
          method: 'ownerOf' as string,
          params: [teamNFT.metadata.id],
        })

        setTeamOwnerAddress(owner)
      } catch (error) {
        console.error('Error getting team owner:', error)
      }
    }

    getTeamOwner()
  }, [teamNFT, teamContract])

  const { queueSafeTx, owners } = useSafe(teamOwnerAddress || '', selectedChain)
  const safeApiKit = useSafeApiKit(selectedChain)

  // Check if the connected wallet is a signer/owner of the Safe
  useEffect(() => {
    async function checkSafeSigner() {
      if (!account?.address || !teamOwnerAddress || owners.length === 0) {
        setIsVerifying(true)
        return
      }

      try {
        // Check if the current account is in the list of Safe owners
        const isOwner = owners.some(
          (owner: string) => owner.toLowerCase() === account.address.toLowerCase()
        )

        setSafeOwners(owners)
        setIsSafeSigner(isOwner)
        setIsVerifying(false)
      } catch (error) {
        console.error('Error checking Safe signer:', error)
        setIsVerifying(false)
      }
    }

    checkSafeSigner()
  }, [account, teamOwnerAddress, owners])

  const handleSubmit = async () => {
    if (!account) {
      toast.error('Please connect your wallet')
      return
    }

    if (!missionData.name || missionData.name.trim() === '') {
      toast.error('Please enter a mission name')
      return
    }

    if (!missionData.tagline || missionData.tagline.trim() === '') {
      toast.error('Please enter a tagline')
      return
    }

    if (!missionData.description || missionData.description.trim() === '') {
      toast.error('Please enter a description')
      return
    }

    if (
      missionData.youtubeLink &&
      missionData.youtubeLink.trim() &&
      !isValidYouTubeUrl(missionData.youtubeLink)
    ) {
      toast.error('Please enter a valid YouTube URL')
      return
    }

    setIsSubmitting(true)

    try {
      // Handle image upload if new image is provided
      let imageIpfsLink = missionLogoUri

      if (newMissionImage) {
        const renamedMissionImage = renameFile(newMissionImage, `${missionData.name} Mission Image`)

        const { cid: newImageIpfsHash } = await pinBlobOrFile(renamedMissionImage)

        imageIpfsLink = `ipfs://${newImageIpfsHash}`
      }

      const missionMetadataBlob = new Blob(
        [
          JSON.stringify({
            name: missionData.name,
            description: missionData.description,
            tagline: missionData.tagline,
            infoUri: missionData.infoUri,
            socialLink: missionData.socialLink,
            logoUri: imageIpfsLink,
            youtubeLink: missionData.youtubeLink,
            tokens: [],
            payButton: 'Brew',
            payDisclosure: '',
            version: 4,
          }),
        ],
        {
          type: 'application/json',
        }
      )

      const { cid: missionMetadataIpfsHash } = await pinBlobOrFile(missionMetadataBlob)

      // Encode the setUriOf transaction for the Safe
      const iface = new ethers.utils.Interface(JBV5ControllerABI.abi as any)
      const txData = iface.encodeFunctionData('setUriOf', [
        mission.projectId,
        `ipfs://${missionMetadataIpfsHash}`,
      ])

      // Queue the transaction in the Safe
      const txHash = await queueSafeTx({
        to: jbControllerContract.address,
        data: txData,
        value: '0',
        safeTxGas: '1000000',
      })

      setSafeTxHash(txHash)
      setTransactionQueued(true)
      toast.success('Transaction queued in Safe!')
    } catch (error: any) {
      console.error('Error updating mission metadata:', error)
      toast.error(error.message || 'Failed to queue transaction')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Poll for transaction execution
  useEffect(() => {
    if (!safeTxHash || !safeApiKit) return

    const txHash = safeTxHash
    let pollInterval: NodeJS.Timeout

    async function checkTransactionStatus() {
      try {
        const tx = await safeApiKit.getTransaction(txHash)
        if (tx.isExecuted) {
          clearInterval(pollInterval)
          toast.success('Transaction executed! Reloading page to show updated metadata...')
          // Wait a bit for subgraph/tableland to sync, then reload
          setTimeout(() => {
            router.reload()
          }, 3000)
        }
      } catch (error) {
        console.error('Error checking transaction status:', error)
      }
    }

    checkTransactionStatus()

    pollInterval = setInterval(checkTransactionStatus, 5000)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [safeTxHash, safeApiKit, router])

  if (isVerifying) {
    return (
      <Modal id="mission-metadata-modal-backdrop" setEnabled={setEnabled}>
        <div className="flex flex-col gap-6 items-center justify-center w-[100vw] md:w-[700px] p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl h-[400px]">
          <LoadingSpinner />
          <p className="text-white text-lg">Verifying permissions...</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal id="mission-metadata-modal-backdrop" setEnabled={setEnabled}>
      <div className="flex flex-col gap-6 items-start justify-start w-[100vw] md:w-[700px] p-6 md:p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl h-screen md:h-auto md:max-h-[90vh] overflow-y-auto">
        <div className="w-full flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Edit Mission</h1>
          <button
            id="close-modal"
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>

        {/* Stage 0: Permission Check or Basic Info */}
        {stage === 0 && !isSafeSigner && (
          <div className="w-full space-y-6">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-red-300 mb-3">Insufficient Permissions</h2>
              <p className="text-white/80 mb-4">
                To edit mission metadata, you must be a signer/owner of the team's Safe multisig
                wallet.
              </p>
              {teamOwnerAddress && (
                <div className="bg-black/20 rounded-lg p-3 mb-4">
                  <p className="text-gray-400 text-sm mb-1">Team Safe Address:</p>
                  <Link
                    className="text-white font-mono text-sm break-all hover:underline"
                    href={`https://app.safe.global/home?safe=${
                      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
                    }:${teamOwnerAddress}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {teamOwnerAddress}
                  </Link>
                </div>
              )}
              {safeOwners.length > 0 && (
                <div className="bg-black/20 rounded-lg p-3 mb-4">
                  <p className="text-gray-400 text-sm mb-2">
                    Current Safe Signers/Owners ({safeOwners.length}):
                  </p>
                  <div className="space-y-1">
                    {safeOwners.map((owner: string) => (
                      <p key={owner} className="text-white/70 font-mono text-xs">
                        {owner}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-200 text-sm">
                  <strong>What to do:</strong> Contact one of the Safe signers above to either:
                </p>
                <ul className="text-yellow-100/80 text-sm mt-2 space-y-1 list-disc list-inside">
                  <li>Add you as a signer/owner to the Safe</li>
                  <li>Have them make the metadata changes themselves</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                className="flex-1 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200"
                onClick={() => setEnabled(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Stage 0: Basic Info (only if Safe signer) */}
        {stage === 0 && isSafeSigner && (
          <>
            <div className="w-full">
              <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
              <MissionMetadataForm missionData={missionData} setMissionData={setMissionData} />
            </div>
            <div className="flex gap-4 mt-4 w-full justify-end">
              <button
                className="px-6 py-3 rounded-xl gradient-2 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (!missionData.name || missionData.name.trim() === '') {
                    toast.error('Please enter a mission name')
                    return
                  }
                  if (!missionData.tagline || missionData.tagline.trim() === '') {
                    toast.error('Please enter a tagline')
                    return
                  }
                  if (
                    missionData.youtubeLink &&
                    missionData.youtubeLink.trim() &&
                    !isValidYouTubeUrl(missionData.youtubeLink)
                  ) {
                    toast.error('Please enter a valid YouTube URL')
                    return
                  }
                  setStage(1)
                }}
              >
                Next: Update Logo
              </button>
            </div>
          </>
        )}

        {/* Stage 1: Logo Upload */}
        {stage === 1 && (
          <>
            <div className="w-full">
              <h2 className="text-lg font-semibold text-white mb-4">Mission Logo</h2>
              <FileInput
                id="mission-image-update"
                label="Mission Logo"
                uri={missionLogoUri}
                setFile={async (file: File) => {
                  setNewMissionImage(file)
                  const renamedMissionImage = renameFile(
                    file,
                    `${missionData.name} Mission Image Preview`
                  )
                  const { cid: missionLogoIpfsHash } = await pinBlobOrFile(renamedMissionImage)
                  setMissionLogoUri(`${IPFS_GATEWAY}${missionLogoIpfsHash}`)
                }}
                dimensions={[1024, 1024]}
                crop
                accept="image/png, image/jpeg, image/webp, image/gif, image/svg"
                acceptText="Accepted file types: PNG, JPEG, WEBP, GIF, SVG"
              />
              {missionLogoUri && (
                <div className="mt-4">
                  <Image
                    src={missionLogoUri}
                    alt="Mission Logo Preview"
                    width={200}
                    height={200}
                    className="rounded-xl"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-4 mt-4 w-full justify-between">
              <button
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200"
                onClick={() => setStage(0)}
              >
                Back
              </button>
              <button
                className="px-6 py-3 rounded-xl gradient-2 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setStage(2)}
              >
                Next: Edit Description
              </button>
            </div>
          </>
        )}

        {/* Stage 2: Description Editor */}
        {stage === 2 && (
          <>
            <div className="w-full">
              <h2 className="text-lg font-semibold text-white mb-4">Mission Description</h2>
              <div
                id="mission-description-editor"
                className="pt-2 rounded-b-[0px] bg-gradient-to-b from-[#0b0c21] from-50% to-transparent to-50% relative"
              >
                <NanceEditor
                  initialValue={missionData.description}
                  fileUploadExternal={async (val) => {
                    try {
                      setIsUploadingImage(true)
                      const res = await pinBlobOrFile(val)
                      return res.url
                    } finally {
                      setIsUploadingImage(false)
                    }
                  }}
                  darkMode={true}
                  onEditorChange={(m: string) => {
                    setMissionData({ ...missionData, description: m })
                  }}
                />
                {isUploadingImage && (
                  <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 rounded-b-[0px]">
                    <Image
                      src="/assets/MoonDAO-Loading-Animation.svg"
                      alt="Uploading..."
                      width={64}
                      height={64}
                      className="mb-4"
                    />
                    <p className="text-white text-lg font-medium">Uploading image...</p>
                    <p className="text-gray-300 text-sm mt-2">
                      Please wait, do not close this window
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-4 mt-4 w-full justify-between">
              <button
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200"
                onClick={() => setStage(1)}
                disabled={isUploadingImage}
              >
                Back
              </button>
              <button
                className="px-6 py-3 rounded-xl gradient-2 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={async () => {
                  if (!missionData.description || missionData.description.trim().length < 10) {
                    toast.error('Please enter a mission description')
                    return
                  }
                  const html = await marked(missionData.description)
                  setMissionData({ ...missionData, description: html })
                  setStage(3)
                }}
                disabled={isUploadingImage}
              >
                Next: Review & Submit
              </button>
            </div>
          </>
        )}

        {/* Stage 3: Review & Submit */}
        {stage === 3 && (
          <>
            <div className="w-full space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">Review Changes</h2>
                <div className="bg-white/5 rounded-xl p-4 space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm">Mission Name</p>
                    <p className="text-white font-semibold">{missionData.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Tagline</p>
                    <p className="text-white">{missionData.tagline}</p>
                  </div>
                  {missionData.infoUri && (
                    <div>
                      <p className="text-gray-400 text-sm">Website</p>
                      <p className="text-white break-all">{missionData.infoUri}</p>
                    </div>
                  )}
                  {missionData.socialLink && (
                    <div>
                      <p className="text-gray-400 text-sm">Social Link</p>
                      <p className="text-white break-all">{missionData.socialLink}</p>
                    </div>
                  )}
                  {missionData.youtubeLink && (
                    <div>
                      <p className="text-gray-400 text-sm">YouTube Link</p>
                      <p className="text-white break-all">{missionData.youtubeLink}</p>
                    </div>
                  )}
                  {missionLogoUri && (
                    <div>
                      <p className="text-gray-400 text-sm mb-2">Logo</p>
                      <Image
                        src={missionLogoUri}
                        alt="Mission Logo"
                        width={150}
                        height={150}
                        className="rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {transactionQueued && (
              <div className="w-full bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <p className="text-white text-sm mb-3">
                  Transaction has been queued in the Safe! Please sign and execute the transaction
                  in the team's{' '}
                  <Link
                    className="font-bold text-green-400 hover:underline"
                    href={`https://app.safe.global/home?safe=${
                      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
                    }:${teamOwnerAddress}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Safe
                  </Link>
                  .
                </p>
                <div className="flex items-center gap-2 mt-3 text-green-300/80">
                  <div className="animate-pulse flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <p className="text-xs">Monitoring for transaction execution...</p>
                  </div>
                </div>
                <p className="text-white/70 text-xs mt-2">
                  This page will automatically reload once the transaction is executed.
                </p>
              </div>
            )}

            {isSubmitting && !transactionQueued && (
              <div className="w-full bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <p className="text-white text-sm">Queueing transaction in Safe...</p>
              </div>
            )}

            <div className="flex gap-4 mt-4 w-full justify-between">
              <button
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200"
                onClick={() => setStage(2)}
                disabled={isSubmitting}
              >
                Back
              </button>
              <PrivyWeb3Button
                v5
                className="px-6 py-3 rounded-xl gradient-2 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                requiredChain={DEFAULT_CHAIN_V5}
                label={isSubmitting ? 'Updating...' : 'Update Mission'}
                isDisabled={isSubmitting}
                action={handleSubmit}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
