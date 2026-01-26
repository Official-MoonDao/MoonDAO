import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { usePrivy } from '@privy-io/react-auth'
import { DEPLOYED_ORIGIN } from 'const/config'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import React, { useContext, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import CitizenContext from '@/lib/citizen/citizen-context'
import { useCitizen } from '@/lib/citizen/useCitizen'
import sendDiscordMessage from '@/lib/discord/sendDiscordMessage'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import useAccount from '@/lib/nance/useAccountAddress'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import MarkdownWithTOC from '../nance/MarkdownWithTOC'

let getMarkdown: GetMarkdown
let setMarkdown: SetMarkdown

const NanceEditor = dynamic(
  async () => {
    const editorModule = await import('@nance/nance-editor')
    getMarkdown = editorModule.getMarkdown
    setMarkdown = editorModule.setMarkdown
    return editorModule.NanceEditor
  },
  {
    ssr: false,
    loading: () => <LoadingSpinner />,
  }
)

const CONTRIBUTION_TEMPLATE = `
## What Did You Get Done?

### Contribution Summary
Document your contributions clearly and concisely, focusing on **what you accomplished and the tangible results**. Follow these guidelines to ensure your contributions are impactful:  

1. **Completed Work Only:** Share work that is finished, not ongoing or planned.  
2. **Specific and Measurable Results:** Highlight tangible outcomes, including metrics, timelines, or other objective measures.  

Clear, detailed, and results-focused contributions help us understand the value and impact of your work.  

---

### Example Contributions  
**Good Contribution:**  
• *"Improved search performance by optimizing database queries, reducing response times by 30% within one month."*  

**Poor Contribution:**  
• *"Worked on improving search performance."* 

`

const ContributionEditor: React.FC = () => {
  const { authenticated } = usePrivy()
  const [submitting, setSubmitting] = useState(false)
  const [coordinapeLink, setCoordinapeLink] = useState<string | null>(null)
  const [templateExpanded, setTemplateExpanded] = useState(false)
  const { address } = useAccount()
  const { citizen } = useContext(CitizenContext)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  useEffect(() => {
    if (setMarkdown) {
      setMarkdown('')
    }
  }, [])

  const handleSubmit = async () => {
    if (!authenticated) {
      toast.error('Please sign in to submit a contribution!')
      return
    }

    if (getMarkdown()?.trim() === '') {
      toast.error('Please write a contribution!')
      return
    }

    if (!address) {
      toast.error('No wallet address found. Please connect your wallet.')
      return
    }

    setSubmitting(true)
    const loadingToast = toast.loading('Submitting contribution...')

    try {
      const body = JSON.stringify({
        description: getMarkdown(),
        address,
      })

      const res = await fetch('/api/coordinape/createContribution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      })
      const data = await res.json()

      if (!res.ok) {
        // Provide specific error messages based on status code
        let errorMessage = 'Failed to submit contribution.'
        if (res.status === 400) {
          errorMessage = data.error || 'Invalid data provided.'
        } else if (res.status === 401) {
          errorMessage = 'You are not authorized. Please sign in again.'
        } else if (res.status === 500) {
          errorMessage = data.error || 'Server error. Please try again later.'
        }

        throw new Error(errorMessage)
      }

      setCoordinapeLink(
        `https://app.coordinape.com/circles/${data.insert_contributions_one.circle_id}`
      )

      sendDiscordMessage(
        'networkNotifications',
        `## **New Contribution made by ${
          citizen?.metadata?.name
            ? `[${
                citizen?.metadata?.name
              }](${DEPLOYED_ORIGIN}/citizen/${generatePrettyLinkWithId(
                citizen?.metadata?.name,
                citizen?.id
              )})`
            : `${address.slice(0, 6)}...${address.slice(-4)}`
        }**\n${getMarkdown()?.trim()}
      `
      )
      toast.success('Contribution submitted successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit contribution.')
    } finally {
      toast.dismiss(loadingToast)
      setSubmitting(false)
    }
  }

  if (!authenticated) {
    return (
      <p className="w-full text-center py-24">
        Please sign in to submit a contribution!
      </p>
    )
  }

  if (coordinapeLink) {
    return (
      <div className="w-full flex flex-col justify-center items-center md:w-auto space-y-4 pb-12">
        <p className="text-2xl">Contribution submitted!</p>
        <p>
          View and edit your contribution{' '}
          <a
            href={coordinapeLink}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            here
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full md:w-auto px-4 sm:px-0">
      <div className="h-full">
        <div className="relative flex flex-col items-center">
          <button
            className="flex items-center gap-2 relative -top-5 text-white/80 hover:text-white transition-colors duration-200 text-sm"
            onClick={() => setTemplateExpanded(!templateExpanded)}
          >
            <p>What should I write?</p>
            <ChevronDownIcon
              className={`h-5 w-5 transition-transform duration-200 ${
                templateExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div className="text-sm text-gray-500">
            {templateExpanded && (
              <MarkdownWithTOC body={CONTRIBUTION_TEMPLATE} />
            )}
          </div>
        </div>
        <div className="h-[600px]">
          <NanceEditor
            fileUploadExternal={async (val) => {
              const res = await pinBlobOrFile(val)
              return res.url
            }}
            darkMode={true}
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
              <p className="text-white text-lg font-medium">
                Uploading image...
              </p>
              <p className="text-gray-300 text-sm mt-2">
                Please wait, do not close this window
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {/* Network Disclaimer */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-yellow-400 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-400 mb-1">
                Network Notice
              </h3>
              <p className="text-sm text-yellow-200/80">
                Please ensure you're connected to the correct blockchain network
                before submitting. You may need to switch networks in your
                wallet to complete your submission successfully.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-xl transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
            disabled={submitting || isUploadingImage}
            onClick={handleSubmit}
          >
            {isUploadingImage ? 'Uploading image...' : 'Submit Contribution'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ContributionEditor
