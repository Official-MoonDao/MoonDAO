import { useState } from 'react'
import { useRouter } from 'next/router'
import { useActiveAccount } from 'thirdweb/react'
import { usePrivy } from '@privy-io/react-auth'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import GoogleDocsImport from './GoogleDocsImport'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'
import {
  PencilSquareIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface ProposalEditSectionProps {
  proposalJSON: any
  projectName: string
  mdp: number
}

export default function ProposalEditSection({
  proposalJSON,
  projectName,
  mdp,
}: ProposalEditSectionProps) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address
  const { authenticated } = usePrivy()

  const [isEditing, setIsEditing] = useState(false)
  const [newBody, setNewBody] = useState<string | undefined>()
  const [newTitle, setNewTitle] = useState<string | undefined>()
  const [isImporting, setIsImporting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const isAuthor =
    authenticated &&
    address &&
    proposalJSON?.authorAddress &&
    address.toLowerCase() === proposalJSON.authorAddress.toLowerCase()

  if (!isAuthor) return null

  const handleSetMarkdown = (markdown: string) => {
    setNewBody(markdown)
  }

  const handleUpdate = async () => {
    if (!newBody) {
      toast.error('Please import your updated Google Doc first.', {
        style: toastStyle,
      })
      return
    }

    setIsUpdating(true)
    try {
      const title = newTitle || projectName
      const header = `# ${title}\n\n`
      const fileName = `${title.replace(/\s+/g, '-')}.md`

      const fileContents = JSON.stringify({
        body: header + newBody,
        budget: proposalJSON?.budget,
        authorAddress: address,
        nonProjectProposal: proposalJSON?.nonProjectProposal,
      })

      const file = new File([fileContents], fileName, {
        type: 'application/json',
      })
      const { url: proposalIPFS } = await pinBlobOrFile(file, '/api/ipfs/pin')

      const res = await fetch('/api/proposals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          proposalTitle: title,
          proposalIPFS,
          proposalId: mdp,
        }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error || 'Failed to update proposal')
      }

      toast.success('Proposal updated successfully! Refreshing...', {
        style: toastStyle,
      })
      setTimeout(() => router.reload(), 4000)
    } catch (error: any) {
      console.error('Error updating proposal:', error)
      toast.error(error.message || 'Failed to update proposal', {
        style: toastStyle,
      })
    } finally {
      setIsUpdating(false)
    }
  }

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-300 hover:text-white bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg transition-all duration-200"
      >
        <PencilSquareIcon className="w-4 h-4" />
        Edit Proposal
      </button>
    )
  }

  return (
    <div className="mt-6 p-5 bg-gradient-to-r from-indigo-900/30 to-blue-900/30 border border-indigo-500/30 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg flex items-center gap-2">
          <PencilSquareIcon className="w-5 h-5 text-indigo-400" />
          Edit Proposal
        </h3>
        <button
          onClick={() => {
            setIsEditing(false)
            setNewBody(undefined)
            setNewTitle(undefined)
          }}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Explainer */}
      <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg flex items-start gap-3">
        <InformationCircleIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-300">
          <p className="font-medium text-blue-300 mb-1">How to edit your proposal:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-400">
            <li>Edit your Google Doc with the changes you want to make</li>
            <li>
              Paste the Google Doc link below and click{' '}
              <span className="text-white">Import</span>
            </li>
            <li>Review the preview, then click{' '}
              <span className="text-white">Update Proposal</span> to save
            </li>
          </ol>
        </div>
      </div>

      {/* Google Docs Import */}
      <div className={isImporting ? 'pointer-events-none opacity-50' : ''}>
        <GoogleDocsImport
          setMarkdown={handleSetMarkdown}
          setTitle={setNewTitle}
          onImportStart={() => setIsImporting(true)}
          onImportEnd={() => setIsImporting(false)}
        />
      </div>

      {/* Preview of imported content */}
      {newBody && (
        <div className="mt-4 rounded-xl border border-white/10 bg-dark-cool overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-black/20">
            <h4 className="text-white font-medium text-sm">Updated Preview</h4>
          </div>
          <div className="p-4 max-h-[300px] overflow-y-auto">
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {newBody}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Update Button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleUpdate}
          disabled={!newBody || isUpdating || isImporting}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/25 flex items-center gap-2"
        >
          {isUpdating ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Updating...
            </>
          ) : (
            'Update Proposal'
          )}
        </button>
      </div>

      {/* Loading Overlay */}
      {isImporting && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
          <Image
            src="/assets/MoonDAO-Loading-Animation.svg"
            alt="Importing..."
            className="w-16 h-16 mb-4"
            width={64}
            height={64}
          />
          <p className="text-white text-lg font-medium">
            Importing document...
          </p>
          <p className="text-gray-300 text-sm mt-2">
            Please wait, do not close this window
          </p>
        </div>
      )}
    </div>
  )
}
