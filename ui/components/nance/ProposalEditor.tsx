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
  const [authorEmail, setAuthorEmail] = useState<string>('')

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
        setAttachBudget(true)
        reset(proposal.budget)
      }
      if (proposal.nonProjectProposal) {
        setNonProjectProposal(proposal.nonProjectProposal)
      }
    }
    if (project?.proposalIPFS) getProposalJSON()
  }, [project?.proposalIPFS])

  const [proposalCache, setProposalCache, clearProposalCache] = useLocalStorage<ProposalCache>(
    `NanceProposalCacheV1-${project?.id || 'new'}`
  )

  // Fetch user's email from Privy if available
  useEffect(() => {
    async function fetchUserEmail() {
      try {
        const { getAccessToken } = await import('@privy-io/react-auth')
        const accessToken = await getAccessToken()
        
        if (accessToken) {
          const response = await fetch('/api/privy/user-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ accessToken }),
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.email && !authorEmail) {
              setAuthorEmail(data.email)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch user email:', error)
        // Don't block the user if this fails
      }
    }
    
    if (address && !authorEmail) {
      fetchUserEmail()
    }
  }, [address])

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
    if (!authorEmail || !authorEmail.includes('@')) {
      console.error('submitProposal: Invalid email provided')
      toast.error('Please enter a valid email address.', {
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
    const { url: proposalIPFS } = await pinBlobOrFile(file, '/api/ipfs/pin')
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
        authorEmail: authorEmail,
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

  const isEditing = project?.MDP !== undefined && project?.MDP > 0

  return (
    <>
      <div className="flex flex-col justify-center items-start animate-fadeIn w-full md:w-full">
        <div className="px-2 w-full md:max-w-[1200px]">
          <form onSubmit={submitProposal}>
            {isEditing && (
              <div className="mb-6 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-amber-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  <div>
                    <h3 className="text-amber-400 font-semibold">Updating MDP-{project.MDP}</h3>
                    <p className="text-sm text-amber-300/80">Edit your Google Doc, then re-import it below to update your proposal.</p>
                  </div>
                </div>
              </div>
            )}
            <div className="">
              <ProposalLocalCache
                proposalCache={proposalCache}
                clearProposalCache={clearProposalCache}
                restoreProposalCache={restoreFromTitleAndBody}
              />
            </div>
            {/* Import and Title Section */}
            <div className="bg-gradient-to-br from-dark-cool/50 to-transparent border border-white/10 rounded-2xl p-6 mb-6">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left Column - Title and Email */}
                <div className="flex-1 space-y-6">
                  <div className={isUploadingImage ? 'pointer-events-none opacity-50' : ''}>
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

                  <div>
                    <label htmlFor="author-email" className="block text-sm font-medium text-white mb-2">
                      Your Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="author-email"
                      type="email"
                      required
                      value={authorEmail}
                      onChange={(e) => setAuthorEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-3 bg-dark-cool border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all autofill:bg-dark-cool autofill:text-white autofill:shadow-[inset_0_0_0px_1000px_rgb(17,24,39)]"
                      disabled={isUploadingImage}
                      style={{
                        WebkitTextFillColor: 'white',
                      }}
                    />
                    <p className="mt-2 text-xs text-gray-400">
                      We'll send you a confirmation email with your proposal link and next steps.
                    </p>
                  </div>
                </div>

                {/* Right Column - Import Button */}
                <div className="lg:w-auto flex items-start lg:pt-0">
                  <div className={`w-full lg:w-auto ${isUploadingImage ? 'pointer-events-none opacity-50' : ''}`}>
                    <GoogleDocsImport 
                      setMarkdown={handleSetMarkdown} 
                      setTitle={setProposalTitle}
                      onImportStart={() => setIsUploadingImage(true)}
                      onImportEnd={() => setIsUploadingImage(false)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Proposal Preview */}
            <div className="mt-4 rounded-xl border border-white/10 bg-dark-cool overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 bg-black/20">
                <h3 className="text-white font-medium">Proposal Preview</h3>
              </div>
              <div className="p-6 min-h-[300px] max-h-[600px] overflow-y-auto">
                {proposalBody ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {proposalBody}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg font-medium">No proposal content yet</p>
                    <p className="text-sm mt-2 text-center max-w-md">
                      Click &quot;Import from Google Docs&quot; above to import your proposal from a Google Doc.
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

            <div className="p-5 rounded-b-[20px] rounded-t-[0px] flex flex-row">
              <Field as="div" className="\ flex items-center mt-5">
                <Switch
                  checked={nonProjectProposal}
                  onChange={(checked) => {
                    setNonProjectProposal(checked)
                  }}
                  className={classNames(
                    nonProjectProposal ? 'bg-indigo-600' : 'bg-gray-200',
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2'
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
                  <span className="font-medium text-gray-900 dark:text-white">
                    Non Project Proposal
                  </span>{' '}
                </Label>
              </Field>
            </div>

            {attachBudget && (
              <FormProvider {...methods}>
                <div className="my-10 p-5 rounded-[20px] bg-dark-cool">
                  <h3 className="text-white text-lg font-medium mb-4">Budget Request (parsed from document)</h3>
                  <RequestBudgetActionForm disableRequiredFields={false} />
                </div>
              </FormProvider>
            )}

            <div className="mt-6 flex flex-col gap-4">
              {/* Submit buttons */}
              <div className="flex justify-end space-x-4">
                {/* SUBMIT */}
                <button
                  type="submit"
                  className={classNames(
                    buttonsDisabled && 'tooltip',
                    'px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-xl transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0'
                  )}
                  onClick={() => {}}
                  disabled={buttonsDisabled}
                  data-tip={
                    signingStatus === 'loading'
                      ? isEditing ? 'Updating...' : 'Submitting...'
                      : isUploadingImage
                      ? 'Uploading image...'
                      : 'You need to connect wallet first.'
                  }
                >
                  {signingStatus === 'loading' 
                    ? (isEditing ? 'Updating...' : 'Submitting...') 
                    : (isEditing ? 'Update Proposal' : 'Submit Proposal')
                  }
                </button>
              </div>
            </div>
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
