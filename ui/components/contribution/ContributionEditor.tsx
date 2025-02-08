import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { usePrivy } from '@privy-io/react-auth'
import dynamic from 'next/dynamic'
import React, { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import useAccount from '@/lib/nance/useAccountAddress'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import EditorMarkdownUpload from '../nance/EditorMarkdownUpload'

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
  const { address } = useAccount()

  useEffect(() => {
    if (setMarkdown) {
      setMarkdown(CONTRIBUTION_TEMPLATE)
    }
  }, [])

  const handleSubmit = async () => {
    if (!authenticated) {
      toast.error('Please sign in to submit a contribution!')
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
      toast.success('Contribution submitted successfully!')
    } catch (err) {
      toast.error('Failed to submit contribution')
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
      <div className="h-[600px]">
        <div className="w-full flex justify-end">
          <div className="w-full md:max-w-[200px]">
            <EditorMarkdownUpload setMarkdown={setMarkdown} />
          </div>
        </div>
        <NanceEditor
          initialValue={CONTRIBUTION_TEMPLATE}
          fileUploadExternal={async (val) => {
            const res = await pinBlobOrFile(val)
            return res.url
          }}
          darkMode={true}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          className="gradient-2 hover:pl-7 disabled:pl-5 disabled:opacity-30 transition-all ease-in-out duration-300 rounded-[2vmax] rounded-tl-[10px] mt-5 px-5 py-3 inline-block disabled:transform-none disabled:cursor-not-allowed"
          disabled={submitting}
          onClick={handleSubmit}
        >
          Submit Contribution
        </button>
      </div>
    </div>
  )
}

export default ContributionEditor
