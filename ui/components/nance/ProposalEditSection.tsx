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
    const title = (newTitle ?? projectName).trim()
    if (!title || title.toLowerCase() === 'untitled') {
      toast.error('Please enter a meaningful proposal title.', {
        style: toastStyle,
      })
      return
    }

    const hasNewBody = !!newBody
    const hasNewTitle = newTitle !== undefined && newTitle.trim() !== projectName.trim()
    if (!hasNewBody && !hasNewTitle) {
      toast.error('Please change the title or import an updated Google Doc.', {
        style: toastStyle,
      })
      return
    }

    setIsUpdating(true)
    try {
      let proposalIPFS: string | undefined

      if (hasNewBody) {
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
        const pinResult = await pinBlobOrFile(file, '/api/ipfs/pin')
        proposalIPFS = pinResult.url
      }

      const res = await fetch('/api/proposals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          ...(hasNewTitle ? { proposalTitle: title } : {}),
          ...(proposalIPFS ? { proposalIPFS } : {}),
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
      setTimeout(() => {
        router.replace(`/project/${mdp}?updated=1`)
      }, 2000)
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
        data-testid="edit-proposal-button"
        onClick={() => setIsEditing(true)}
        className="inline-flex items-center gap-1.5 h-7 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm font-medium text-indigo-300 hover:text-white bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg transition-all duration-200"
      >
        <PencilSquareIcon className="w-3.5 h-3.5" />
        Edit Proposal
      </button>
    )
  }

  return (
    <div data-testid="edit-proposal-panel" className="mt-6 p-5 bg-gradient-to-r from-indigo-900/30 to-blue-900/30 border border-indigo-500/30 rounded-xl w-full basis-full">
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
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>To <span className="text-white">rename</span> your proposal, edit the title below and click <span className="text-white">Update Proposal</span></li>
            <li>To <span className="text-white">update the body</span>, paste your edited Google Doc link, import it, then click <span className="text-white">Update Proposal</span></li>
          </ul>
        </div>
      </div>

      {/* Title Input */}
      <div className="flex flex-col gap-3 w-full mb-4">
        <div className="flex items-center gap-2 text-white">
          <PencilSquareIcon className="w-5 h-5 text-indigo-400" />
          <label htmlFor="proposal-title" className="font-medium">Proposal Title</label>
        </div>
        <div className="relative flex-1">
          <input
            id="proposal-title"
            type="text"
            value={newTitle ?? projectName}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter proposal title"
            className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
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
          disabled={isUpdating || isImporting || (!newBody && (newTitle === undefined || newTitle.trim() === projectName.trim()))}
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
