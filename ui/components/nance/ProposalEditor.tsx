import { Field, Label, Switch } from '@headlessui/react'
import { ProposalStatus } from '@/lib/nance/useProposalStatus'
import {
  Action,
  RequestBudget,
  actionsToYaml,
  getActionsFromBody,
  trimActionsFromBody,
} from '@nance/nance-sdk'
import { Project } from '@/lib/project/useProjectData'
import { getUnixTime } from 'date-fns'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useLocalStorage } from 'react-use'
import { useActiveAccount } from 'thirdweb/react'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import useAccount from '@/lib/nance/useAccountAddress'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { classNames } from '@/lib/utils/tailwind'
import ProposalTitleInput from '@/components/nance/ProposalTitleInput'
import GoogleDocsImport from './GoogleDocsImport'
import ProposalSubmissionCTA from './ProposalSubmissionCTA'
import RequestBudgetActionForm from './RequestBudgetActionForm'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type SignStatus = 'idle' | 'loading' | 'success' | 'error'

const ProposalLocalCache = dynamic(import('@/components/nance/ProposalLocalCache'), { ssr: false })

const DEFAULT_REQUEST_BUDGET_VALUES: RequestBudget = {
  budget: [{ token: 'ETH', amount: '', justification: 'dev cost' }],
}

export type ProposalCache = {
  title?: string
  body?: string
  timestamp: number
}

export default function ProposalEditor({ project }: { project: Project }) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address
  const { selectedWallet } = useContext(PrivyWalletContext)

  const [signingStatus, setSigningStatus] = useState<SignStatus>('idle')
  const [attachBudget, setAttachBudget] = useState<boolean>(false)
  const [nonProjectProposal, setNonProjectProposal] = useState<boolean>(false)
  const [proposalTitle, setProposalTitle] = useState<string | undefined>()
  const [proposalBody, setProposalBody] = useState<string | undefined>()
  const [proposalStatus, setProposalStatus] = useState<ProposalStatus>('Discussion')
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false)
  const [showSubmissionCTA, setShowSubmissionCTA] = useState<boolean>(false)
  const [submittedProposalId, setSubmittedProposalId] = useState<string | undefined>()

  useEffect(() => {
    async function getProposalJSON() {
      const proposalResponse = await fetch(project.proposalIPFS)
      const proposal = await proposalResponse.json()
      const proposalLines = proposal.body.split('\n')
      const proposalTitle = proposalLines[0].slice(1).trim()
      const proposalBody = proposalLines.slice(1).join('\n')
      setProposalBody(proposalBody)
      setProposalTitle(proposalTitle)
      if (proposal.budget) {
        reset(proposal.budget)
      }
    }
    if (project?.proposalIPFS) getProposalJSON()
  }, [project?.proposalIPFS])

  const [proposalCache, setProposalCache, clearProposalCache] = useLocalStorage<ProposalCache>(
    `NanceProposalCacheV1-${project?.id || 'new'}`
  )

  const methods = useForm<RequestBudget>({
    mode: 'onBlur',
  })
  const { reset, getValues, watch } = methods

  function restoreFromTitleAndBody(t: string, b: string) {
    setProposalTitle(t)
    setProposalBody(trimActionsFromBody(b))
    const actions = getActionsFromBody(b)
    if (!actions) return
    setAttachBudget(true)
    reset(actions[0].payload as RequestBudget)
  }

  // Function to set markdown content from Google Docs import
  const handleSetMarkdown = (markdown: string) => {
    setProposalBody(markdown)
    
    // Parse budget from markdown
    const budgetInfo = parseBudgetFromMarkdown(markdown)
    if (budgetInfo && budgetInfo.length > 0) {
      setAttachBudget(true)
      reset({ budget: budgetInfo })
    }
  }

  // Parse budget information from markdown content
  const parseBudgetFromMarkdown = (markdown: string): Array<{ token: string; amount: string; justification: string }> | null => {
    const budgetSection = markdown.match(/##?\s*Budget\s*Request[:\s]*([\s\S]*?)(?=\n##|\n#|$)/i)
    if (!budgetSection) return null
    
    const budgetText = budgetSection[1]
    const budgets: Array<{ token: string; amount: string; justification: string }> = []
    
    // Look for patterns like "10 ETH for development" or "Amount: 10 ETH"
    const amountPattern = /(?:^|\n)[-*]?\s*(?:Amount[:\s]+)?(\d+(?:\.\d+)?)\s*(ETH|USDC|DAI|MOONEY|vMOONEY)(?:\s+(?:for|:|-)?\s*(.+?))?(?=\n|$)/gi
    let match
    
    while ((match = amountPattern.exec(budgetText)) !== null) {
      budgets.push({
        amount: match[1],
        token: match[2].toUpperCase(),
        justification: match[3]?.trim() || 'Budget request'
      })
    }
    
    // Also check for table format
    const tableRows = budgetText.match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g)
    if (tableRows && tableRows.length > 1) {
      for (let i = 2; i < tableRows.length; i++) { // Skip header and separator
        const cells = tableRows[i].split('|').map(cell => cell.trim()).filter(cell => cell)
        if (cells.length >= 2) {
          const amountMatch = cells[0].match(/(\d+(?:\.\d+)?)\s*(ETH|USDC|DAI|MOONEY|vMOONEY)/i)
          if (amountMatch) {
            budgets.push({
              amount: amountMatch[1],
              token: amountMatch[2].toUpperCase(),
              justification: cells[1] || 'Budget request'
            })
          }
        }
      }
    }
    
    return budgets.length > 0 ? budgets : null
  }

  const { wallet } = useAccount()
  const buttonsDisabled = !address || signingStatus === 'loading' || isUploadingImage

  async function submitProposal(e: any) {
    let body = proposalBody || ''
    e.preventDefault()
    setSigningStatus('loading')
    if (!proposalTitle) {
      console.error('submitProposal: No title provided')
      toast.error('Please enter a title for the proposal.', {
        style: toastStyle,
      })
      setSigningStatus('error')
      return
    }
    const header = `# ${proposalTitle}\n\n`
    const fileName = `${proposalTitle.replace(/\s+/g, '-')}.md`

    const fileContents = JSON.stringify({
      body: header + body,
      budget: getValues()['budget'],
      authorAddress: address,
      nonProjectProposal: nonProjectProposal
    })
    const file = new File([fileContents], fileName, {
      type: 'application/json',
    })
    const { url: proposalIPFS } = await pinBlobOrFile(file)
    const res = await fetch(`/api/proposals/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Important: Specify the content type
      },
      body: JSON.stringify({
        address: address,
        proposalTitle: proposalTitle,
        proposalIPFS: proposalIPFS,
        proposalId: project?.MDP || 0,
        body: body,
        budget: getValues()['budget'],
      }),
    })
    if (!res.ok) {
      const { error } = await res.json() // Or response.json()
      toast.error(error, {
        style: toastStyle,
      })
      console.error(error)
      setSigningStatus('error')
    } else {
      const response = await res.json()
      setSubmittedProposalId(response.proposalId)
      setSigningStatus('success')
      setShowSubmissionCTA(true)
      try {
        const { getAccessToken } = await import('@privy-io/react-auth')
        const accessToken = await getAccessToken()

        const notificationResponse = await fetch('/api/proposal/new-proposal-notification', {
          method: 'POST',
          body: JSON.stringify({
            proposalId: response.proposalId,
            accessToken: accessToken,
            selectedWallet: selectedWallet,
          }),
        })

        const notificationData = await notificationResponse.json()
        if (notificationData?.message) {
          console.log('Notification result:', notificationData.message)
        }
      } catch (notificationError: any) {
        console.error('Failed to send notification:', notificationError)
        // Don't block the user experience if notification fails
      }
      return response.url
    }
  }

  const saveProposalBodyCache = function () {
    let body = proposalBody || ''
    if (attachBudget) {
      const action = {
        type: 'Request Budget',
        payload: getValues(),
      } as Action
      body = `${body}\n\n${actionsToYaml([action])}`
    }

    setProposalCache({
      timestamp: getUnixTime(new Date()),
      title: proposalCache?.title || proposalTitle,
      body: body || undefined,
    })
  }

  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      if (type === 'change') {
        saveProposalBodyCache()
      }
    })

    return () => subscription.unsubscribe()
  }, [watch])

  // Save cache when proposalBody changes
  useEffect(() => {
    if (proposalBody) {
      saveProposalBodyCache()
    }
  }, [proposalBody])

  return (
    <>
      <div className="flex flex-col justify-center items-start animate-fadeIn w-full md:w-full">
        <div className="w-full md:max-w-[1200px]">
          <form onSubmit={submitProposal}>
            {/* Local Cache Restore/Clear */}
            <ProposalLocalCache
              proposalCache={proposalCache}
              clearProposalCache={clearProposalCache}
              restoreProposalCache={restoreFromTitleAndBody}
            />

            {/* Google Docs Import Section - Made Prominent */}
            <div className="mb-6 p-5 bg-gradient-to-r from-indigo-900/40 to-blue-900/40 border border-indigo-500/30 rounded-xl">
              <div className="flex flex-col gap-4">
                <div className={`${isUploadingImage ? 'pointer-events-none opacity-50' : ''}`}>
                  <GoogleDocsImport 
                    setMarkdown={handleSetMarkdown} 
                    setTitle={setProposalTitle}
                    onImportStart={() => setIsUploadingImage(true)}
                    onImportEnd={() => setIsUploadingImage(false)}
                  />
                </div>
              </div>
            </div>

            {/* Title Input */}
            <div className={`mb-4 ${isUploadingImage ? 'pointer-events-none opacity-50' : ''}`}>
              <label className="block text-sm font-medium text-gray-300 mb-2">Proposal Title</label>
              <ProposalTitleInput
                value={proposalTitle}
                onChange={(s) => {
                  if (isUploadingImage) return
                  setProposalTitle(s)
                  console.debug('setProposalTitle', s)
                  const cache = proposalCache || {
                    body: proposalBody || '',
                  }
                  setProposalCache({
                    ...cache,
                    title: s,
                    timestamp: getUnixTime(new Date()),
                  })
                }}
              />
            </div>
            {/* Proposal Preview */}
            <div className="rounded-xl border border-white/10 bg-dark-cool overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 bg-black/20">
                <h3 className="text-white font-medium">Proposal Preview</h3>
              </div>
              <div className="p-6 min-h-[250px] max-h-[500px] overflow-y-auto">
                {proposalBody ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {proposalBody}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
                    <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-base font-medium">No content yet</p>
                    <p className="text-sm mt-1 text-center max-w-sm text-gray-500">
                      Import your Google Doc above to see a preview here
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Loading Overlay */}
            {isUploadingImage && (
              <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
                <img
                  src="/assets/MoonDAO-Loading-Animation.svg"
                  alt="Importing..."
                  className="w-16 h-16 mb-4"
                />
                <p className="text-white text-lg font-medium">Importing document...</p>
                <p className="text-gray-300 text-sm mt-2">
                  Please wait, do not close this window
                </p>
              </div>
            )}

            {/* Options Row */}
            <div className="mt-5 p-4 rounded-xl bg-black/20 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Field as="div" className="flex items-center">
                <Switch
                  checked={nonProjectProposal}
                  onChange={(checked) => {
                    setNonProjectProposal(checked)
                  }}
                  className={classNames(
                    nonProjectProposal ? 'bg-indigo-600' : 'bg-gray-600',
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 focus:ring-offset-gray-900'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={classNames(
                      nonProjectProposal ? 'translate-x-5' : 'translate-x-0',
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                    )}
                  />
                </Switch>
                <Label as="span" className="ml-3 text-sm">
                  <span className="text-gray-300">
                    Non-Project Proposal
                  </span>
                </Label>
              </Field>
              
              {/* Submit Button */}
              <button
                type="submit"
                className={classNames(
                  buttonsDisabled && 'tooltip',
                  'px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0'
                )}
                disabled={buttonsDisabled}
                data-tip={
                  signingStatus === 'loading'
                    ? 'Submitting...'
                    : isUploadingImage
                    ? 'Uploading image...'
                    : 'You need to connect wallet first.'
                }
              >
                {signingStatus === 'loading' ? 'Submitting...' : 'Submit Proposal'}
              </button>
            </div>

            {attachBudget && (
              <FormProvider {...methods}>
                <div className="my-6 p-5 rounded-xl bg-dark-cool border border-white/10">
                  <h3 className="text-white text-lg font-medium mb-4">Budget Request (parsed from document)</h3>
                  <RequestBudgetActionForm disableRequiredFields={false} />
                </div>
              </FormProvider>
            )}
          </form>
        </div>
      </div>

      {/* Proposal Submission CTA Modal */}
      {showSubmissionCTA && (
        <ProposalSubmissionCTA
          proposalId={submittedProposalId}
          onClose={() => {
            setShowSubmissionCTA(false)
            // Redirect to proposal page after closing CTA
            if (submittedProposalId) {
              router.push(`/project/${submittedProposalId}`)
            }
          }}
        />
      )}
    </>
  )
}
