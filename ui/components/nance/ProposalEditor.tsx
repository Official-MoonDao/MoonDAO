import { Field, Label, Switch } from '@headlessui/react'
import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import {
  useProposal,
  useProposalUpload,
  useSpaceInfo,
} from '@nance/nance-hooks'
import {
  Action,
  Proposal,
  ProposalStatus,
  RequestBudget,
  actionsToYaml,
  getActionsFromBody,
  trimActionsFromBody,
} from '@nance/nance-sdk'
import { add, differenceInDays, getUnixTime } from 'date-fns'
import { StringParam, useQueryParams } from 'next-query-params'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useLocalStorage } from 'react-use'
import { useActiveAccount } from 'thirdweb/react'
import { NANCE_SPACE_NAME, proposalIdPrefix } from '../../lib/nance/constants'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { TEMPLATE, uuidGen } from '@/lib/nance'
import useAccount from '@/lib/nance/useAccountAddress'
import { useSignProposal } from '@/lib/nance/useSignProposal'
import { classNames } from '@/lib/utils/tailwind'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import ProposalTitleInput from '@/components/nance/ProposalTitleInput'
import EditorMarkdownUpload from './EditorMarkdownUpload'
import ProposalSubmissionCTA from './ProposalSubmissionCTA'
import RequestBudgetActionForm from './RequestBudgetActionForm'

type SignStatus = 'idle' | 'loading' | 'success' | 'error'

const ProposalLocalCache = dynamic(
  import('@/components/nance/ProposalLocalCache'),
  { ssr: false }
)

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
  budget: [
    { token: '', amount: '', justification: 'dev cost' },
    { token: '', amount: '', justification: 'flex' },
  ],
}

export type ProposalCache = {
  title?: string
  body?: string
  timestamp: number
}

export default function ProposalEditor() {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address

  const [signingStatus, setSigningStatus] = useState<SignStatus>('idle')
  const [attachBudget, setAttachBudget] = useState<boolean>(false)
  const [proposalTitle, setProposalTitle] = useState<string | undefined>()
  const [proposalStatus, setProposalStatus] =
    useState<ProposalStatus>('Discussion')
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false)
  const [showSubmissionCTA, setShowSubmissionCTA] = useState<boolean>(false)
  const [submittedProposalId, setSubmittedProposalId] = useState<
    string | undefined
  >()

  const { data: spaceInfoData } = useSpaceInfo({ space: NANCE_SPACE_NAME })
  const spaceInfo = spaceInfoData?.data
  const { nextEvents, currentEvent } = spaceInfo || {}
  let nextSnapshotVote = nextEvents?.find(
    (event) => event.title === 'Snapshot Vote'
  )
  const nextProposalId = spaceInfo?.nextProposalId
  if (currentEvent?.title === 'Temperature Check') {
    const days = differenceInDays(
      new Date(nextEvents?.slice(-1)[0]?.start || ''),
      new Date(currentEvent.start)
    )
    nextSnapshotVote = {
      title: 'Snapshot Vote',
      start: add(new Date(nextSnapshotVote?.start || ''), {
        days,
      }).toISOString(),
      end: add(new Date(nextSnapshotVote?.end || ''), { days }).toISOString(),
    }
  }

  const [{ proposalId }] = useQueryParams({ proposalId: StringParam })
  const shouldFetch = !!proposalId
  const { data } = useProposal(
    { space: NANCE_SPACE_NAME, uuid: proposalId! },
    shouldFetch
  )
  const loadedProposal = data?.data

  const [proposalCache, setProposalCache, clearProposalCache] =
    useLocalStorage<ProposalCache>(
      `NanceProposalCacheV1-${loadedProposal?.uuid.substring(0, 5) || 'new'}`
    )

  const methods = useForm<RequestBudget>({
    mode: 'onBlur',
  })
  const { handleSubmit, reset, getValues, watch } = methods

  function restoreFromTitleAndBody(t: string, b: string) {
    setProposalTitle(t)
    setMarkdown?.(trimActionsFromBody(b))
    const actions = getActionsFromBody(b)
    if (!actions) return
    console.debug('loaded action:', actions)
    setAttachBudget(true)
    reset(actions[0].payload as RequestBudget)
  }

  useEffect(() => {
    if (loadedProposal) {
      restoreFromTitleAndBody(loadedProposal.title, loadedProposal.body)
    }
  }, [loadedProposal])

  const onSubmit: SubmitHandler<RequestBudget> = async (formData) => {
    console.log('onSubmit called', {
      formData,
      proposalStatus,
      attachBudget,
      proposalTitle,
      bodyLength: getMarkdown()?.length || 0,
    })

    let proposal = buildProposal(proposalStatus)

    if (attachBudget) {
      const uuid = uuidGen()
      const action: Action = {
        type: 'Request Budget',
        payload: formData,
        uuid,
        chainId: 1,
      }
      const body = `${proposal.body}\n\n${actionsToYaml([action])}`
      proposal = {
        ...proposal,
        body,
      }
    }

    console.debug('RequestBudget.submit', {
      formData,
      proposalStatus,
      proposal,
    })
    signAndSendProposal(proposal)
  }

  const { wallet } = useAccount()
  const { signProposalAsync } = useSignProposal(wallet)
  const { trigger } = useProposalUpload(NANCE_SPACE_NAME, loadedProposal?.uuid)
  const buttonsDisabled =
    !address || signingStatus === 'loading' || isUploadingImage

  const buildProposal = (status: ProposalStatus) => {
    return {
      title: proposalTitle,
      body: getMarkdown(),
      status,
      voteSetup: {
        type: 'quadratic',
        choices: ['Yes', 'No', 'Abstain'],
      },
    } as Proposal
  }

  async function submitProposal(e) {
    let body = getMarkdown()
    e.preventDefault()
    console.log('submit')
    //console.log('body')
    console.log('getValues')
    console.log(getValues())
    //console.log(body)
    const header = `# ${proposalTitle}\n\n`
    const fileName = `${proposalTitle.replace(/\s+/g, '-')}.md`

    const file = new File([header + body], fileName, {
      type: 'text/markdown',
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
        body: body,
        budget: getValues()['budget'],
      }),
    })
    if (!res.ok) {
      const errorText = await res.text() // Or response.json()
      console.error(errorText)
    } else {
      const response = await res.json()
      console.log('response')
      console.log(response)
    }
    //return res.url
  }

  async function signAndSendProposal(proposal: Proposal) {
    console.log('signAndSendProposal: Starting proposal submission', {
      title: proposal.title,
      bodyLength: proposal.body?.length || 0,
      address,
      nextSnapshotVote: !!nextSnapshotVote,
      loadedProposalId: loadedProposal?.proposalId,
      nextProposalId,
    })

    if (!proposal.title) {
      console.error('signAndSendProposal: No title provided')
      toast.error('Please enter a title for the proposal.', {
        style: toastStyle,
      })
      return
    }

    if (!proposal.body || proposal.body.trim().length === 0) {
      console.error('signAndSendProposal: No content provided')
      toast.error('Please write some content for the proposal.', {
        style: toastStyle,
      })
      return
    }

    if (!address) {
      console.error('signAndSendProposal: No wallet address')
      toast.error('Please connect your wallet to submit a proposal.', {
        style: toastStyle,
      })
      return
    }

    if (!nextSnapshotVote) {
      console.error('signAndSendProposal: No next snapshot vote available', {
        spaceInfo,
        nextEvents,
      })
      toast.error('Unable to schedule proposal vote. Please try again later.', {
        style: toastStyle,
      })
      return
    }

    setSigningStatus('loading')
    const t = toast.loading('Sign proposal...', {
      style: toastStyle,
    })
    const proposalId = loadedProposal?.proposalId || nextProposalId
    const preTitle = `${proposalIdPrefix}${proposalId}: `

    console.log('signAndSendProposal: About to sign proposal', {
      proposalId,
      preTitle,
      nextSnapshotVote,
    })

    signProposalAsync(proposal, preTitle, nextSnapshotVote)
      .then((res) => {
        console.log('signAndSendProposal: Signature received', {
          hasSignature: !!res.signature,
          hasMessage: !!res.message,
          address: res.address,
        })
        const { signature, message, address } = res
        trigger({
          proposal,
          envelope: {
            type: 'SnapshotSubmitProposal',
            address,
            signature,
            message,
          },
        })
          .then((res) => {
            console.log('signAndSendProposal: Upload response', res)
            if (res.success) {
              setSigningStatus('success')
              clearProposalCache()
              toast.dismiss(t)
              toast.success('Proposal submitted successfully!', {
                style: toastStyle,
              })
              // Show CTA instead of immediate redirect
              setSubmittedProposalId(res.data.uuid)
              setShowSubmissionCTA(true)
            } else {
              console.error('signAndSendProposal: Upload failed', res)
              setSigningStatus('error')
              toast.dismiss(t)
              toast.error(
                `Error saving proposal: ${res.error || 'Unknown error'}`,
                { style: toastStyle }
              )
            }
          })
          .catch((error) => {
            console.error('signAndSendProposal: Upload error', error)
            setSigningStatus('error')
            toast.dismiss(t)
            toast.error(
              `[API] Error submitting proposal:\n${error.message || error}`,
              {
                style: toastStyle,
              }
            )
          })
      })
      .catch((error) => {
        console.error('signAndSendProposal: Signing error', error)
        setSigningStatus('idle')
        toast.dismiss(t)
        toast.error(
          `[Wallet] Error signing proposal:\n${error.message || error}`,
          {
            style: toastStyle,
          }
        )
      })
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
                      body: loadedProposal?.body || TEMPLATE,
                    }
                    setProposalCache({
                      ...cache,
                      title: s,
                      timestamp: getUnixTime(new Date()),
                    })
                  }}
                />
              </div>
              <div
                className={`${
                  isUploadingImage ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <EditorMarkdownUpload setMarkdown={setMarkdown} />
              </div>
            </div>
            <div className="pt-2 rounded-b-[0px] bg-gradient-to-b from-[#0b0c21] from-50% to-transparent to-50% relative">
              <NanceEditor
                initialValue={loadedProposal?.body || TEMPLATE}
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
                  <p className="text-white text-lg font-medium">
                    Uploading image...
                  </p>
                  <p className="text-gray-300 text-sm mt-2">
                    Please wait, do not close this window
                  </p>
                </div>
              )}
            </div>

            <div className="p-5 rounded-b-[20px] rounded-t-[0px] ">
              <Field as="div" className="\ flex items-center mt-5">
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
                  <span className="font-medium text-gray-900 dark:text-white">
                    Attach Budget
                  </span>{' '}
                </Label>
              </Field>
            </div>

            {attachBudget && (
              <FormProvider {...methods}>
                <div className="my-10 p-5 rounded-[20px] bg-dark-cool">
                  <RequestBudgetActionForm
                    disableRequiredFields={proposalStatus === 'Draft'}
                  />
                </div>
              </FormProvider>
            )}

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
                      Please ensure you're connected to the correct blockchain
                      network before submitting. You may need to switch networks
                      in your wallet to complete your submission successfully.
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit buttons */}
              <div className="flex justify-end space-x-4">
                {/*  DRAFT */}
                <button
                  type="submit"
                  className={classNames(
                    buttonsDisabled && 'tooltip',
                    'text-sm px-6 py-3 bg-black/30 hover:bg-black/40 border border-white/20 hover:border-white/30 text-white/80 hover:text-white font-RobotoMono rounded-xl transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 transform hover:scale-[1.02] shadow-lg hover:shadow-xl'
                  )}
                  onClick={() => {
                    console.log('Save Draft button clicked', {
                      buttonsDisabled,
                      address: !!address,
                      signingStatus,
                      isUploadingImage,
                    })
                    setProposalStatus('Draft')
                  }}
                  disabled={buttonsDisabled}
                  data-tip={
                    signingStatus === 'loading'
                      ? 'Signing...'
                      : isUploadingImage
                      ? 'Uploading image...'
                      : 'You need to connect wallet first.'
                  }
                >
                  {signingStatus === 'loading' ? 'Signing...' : 'Save Draft'}
                </button>
                {/* SUBMIT */}
                <button
                  type="submit"
                  className={classNames(
                    buttonsDisabled && 'tooltip',
                    'px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-xl transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0'
                  )}
                  onClick={() => {
                    console.log('Submit button clicked', {
                      buttonsDisabled,
                      address: !!address,
                      signingStatus,
                      isUploadingImage,
                      loadedProposalStatus: loadedProposal?.status,
                    })
                    const status =
                      loadedProposal?.status === 'Temperature Check'
                        ? 'Temperature Check'
                        : 'Discussion'
                    setProposalStatus(status || 'Discussion')
                  }}
                  disabled={buttonsDisabled}
                  data-tip={
                    signingStatus === 'loading'
                      ? 'Signing...'
                      : isUploadingImage
                      ? 'Uploading image...'
                      : 'You need to connect wallet first.'
                  }
                >
                  {signingStatus === 'loading' ? 'Signing...' : 'Submit'}
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
              router.push(`/proposal/${submittedProposalId}`)
            }
          }}
        />
      )}
    </>
  )
}
