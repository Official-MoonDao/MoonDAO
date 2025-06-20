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
import EditorMarkdownUpload from '../nance/EditorMarkdownUpload'
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
        throw new Error(data.error)
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
        }**
      ${getMarkdown()?.trim()}
      `
      )
      toast.success('Contribution submitted successfully!')
    } catch (err) {
      toast.error('Failed to submit contribution.')
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
            className="flex items-center gap-2 relative -top-5"
            onClick={() => setTemplateExpanded(!templateExpanded)}
          >
            <p>What should I write?</p>
            <ChevronDownIcon
              className={`h-6 w-6 ${
                templateExpanded ? 'rotate-180 duration-150' : ''
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
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          className="gradient-2 hover:pl-7 disabled:pl-5 disabled:opacity-30 transition-all ease-in-out duration-300 rounded-[2vmax] rounded-tl-[10px] mt-5 px-5 py-3 inline-block disabled:transform-none disabled:cursor-not-allowed"
          disabled={submitting || isUploadingImage}
          onClick={handleSubmit}
        >
          {isUploadingImage ? 'Uploading image...' : 'Submit Contribution'}
        </button>
      </div>
    </div>
  )
}

export default ContributionEditor
