import { Field, Label, Switch } from '@headlessui/react'
import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { ProposalStatus } from '@/lib/nance/useProposalStatus'
import { useProposal, useProposalUpload, useSpaceInfo } from '@nance/nance-hooks'
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
import { TEMPLATE } from '@/lib/nance'
import useAccount from '@/lib/nance/useAccountAddress'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { classNames } from '@/lib/utils/tailwind'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import ProposalTitleInput from '@/components/nance/ProposalTitleInput'
import EditorMarkdownUpload from './EditorMarkdownUpload'
import ProposalSubmissionCTA from './ProposalSubmissionCTA'
import RequestBudgetActionForm from './RequestBudgetActionForm'

// FIXME what is this for?
const DRAFTS_ENABLED = false

type SignStatus = 'idle' | 'loading' | 'success' | 'error'

const ProposalLocalCache = dynamic(import('@/components/nance/ProposalLocalCache'), { ssr: false })

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
      setMarkdown?.(proposalBody)
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
    setMarkdown?.(trimActionsFromBody(b))
    const actions = getActionsFromBody(b)
    if (!actions) return
    setAttachBudget(true)
    reset(actions[0].payload as RequestBudget)
  }

  const { wallet } = useAccount()
  const buttonsDisabled = !address || signingStatus === 'loading' || isUploadingImage

  async function submitProposal(e: any) {
    let body = getMarkdown()
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
    let body = getMarkdown()
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

  return (
    <>
      <div className="flex flex-col justify-center items-start animate-fadeIn w-full md:w-full">
        <div className="px-2 w-full md:max-w-[1200px]">
          <form onSubmit={submitProposal}>
            <div className="">
              <ProposalLocalCache
                proposalCache={proposalCache}
                clearProposalCache={clearProposalCache}
                restoreProposalCache={restoreFromTitleAndBody}
              />
            </div>
            <div className="py-0 rounded-[20px] flex flex-col md:flex-row justify-between gap-4">
              <div
                className={`mb-4 flex-shrink-0 w-full md:w-2/3 ${
                  isUploadingImage ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <ProposalTitleInput
                  value={proposalTitle}
                  onChange={(s) => {
                    if (isUploadingImage) return // Prevent changes during upload
                    setProposalTitle(s)
                    console.debug('setProposalTitle', s)
                    const cache = proposalCache || {
                      body: proposalBody || TEMPLATE,
                    }
                    setProposalCache({
                      ...cache,
                      title: s,
                      timestamp: getUnixTime(new Date()),
                    })
                  }}
                />
              </div>
              <div className={`${isUploadingImage ? 'pointer-events-none opacity-50' : ''}`}>
                <EditorMarkdownUpload setMarkdown={setMarkdown} />
              </div>
            </div>
            <div className="pt-2 rounded-b-[0px] bg-gradient-to-b from-[#0b0c21] from-50% to-transparent to-50% relative">
              <NanceEditor
                initialValue={proposalBody || TEMPLATE}
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
                onEditorChange={(m) => {
                  saveProposalBodyCache()
                }}
              />

              {/* Image Upload Loading Overlay */}
              {isUploadingImage && (
                <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 rounded-b-[0px]">
                  <img
                    src="/assets/MoonDAO-Loading-Animation.svg"
                    alt="Uploading..."
                    className="w-16 h-16 mb-4"
                  />
                  <p className="text-white text-lg font-medium">Uploading image...</p>
                  <p className="text-gray-300 text-sm mt-2">
                    Please wait, do not close this window
                  </p>
                </div>
              )}
            </div>

            <div className="p-5 rounded-b-[20px] rounded-t-[0px] flex flex-row">
              <Field as="div" className="\ flex items-center mt-5 pr-4">
                <Switch
                  checked={attachBudget}
                  onChange={(checked) => {
                    setAttachBudget(checked)
                    if (checked) {
                      reset(DEFAULT_REQUEST_BUDGET_VALUES)
                    }
                  }}
                  className={classNames(
                    attachBudget ? 'bg-indigo-600' : 'bg-gray-200',
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={classNames(
                      attachBudget ? 'translate-x-5' : 'translate-x-0',
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                    )}
                  />
                </Switch>
                <Label as="span" className="ml-3 text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">Attach Budget</span>{' '}
                </Label>
              </Field>
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
                      ? 'Submitting...'
                      : isUploadingImage
                      ? 'Uploading image...'
                      : 'You need to connect wallet first.'
                  }
                >
                  {signingStatus === 'loading' ? 'Submitting...' : 'Submit'}
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
