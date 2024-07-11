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
import { add, differenceInDays, formatDistance, fromUnixTime, getUnixTime } from 'date-fns'
import { StringParam, useQueryParams } from 'next-query-params'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import toastStyle from '../../lib/marketplace/marketplace-utils/toastConfig'
import { TEMPLATE } from '@/lib/nance'
import { NANCE_SPACE_NAME, proposalIdPrefix } from '../../lib/nance/constants'
import useAccount from '../../lib/nance/useAccountAddress'
import { useSignProposal } from '../../lib/nance/useSignProposal'
import { classNames } from '../../lib/utils/tailwind'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import Head from '../../components/layout/Head'
import { LoadingSpinner } from '../../components/layout/LoadingSpinner'
import ProposalTitleInput from '../../components/nance/ProposalTitleInput'
import RequestBudgetActionForm from './RequestBudgetActionForm'
import { pinBlobOrFile } from "@/lib/ipfs/pinBlobOrFile"
import { useLocalStorage } from 'react-use'

type SignStatus = 'idle' | 'loading' | 'success' | 'error'

// Nance Editor
let getMarkdown: GetMarkdown
let setMarkdown: SetMarkdown

const NanceEditor = dynamic(
  async () => {
    getMarkdown = (await import('@nance/nance-editor')).getMarkdown
    setMarkdown = (await import("@nance/nance-editor")).setMarkdown
    return import('@nance/nance-editor').then((mod) => mod.NanceEditor)
  },
  {
    ssr: false,
    loading: () => <LoadingSpinner />,
  }
)

const ResultModal = dynamic(() => import("./ResultModal"), {
  ssr: false,
});

const DEFAULT_MULTISIG_TEAM: RequestBudget['multisigTeam'][number] = {
  discordUserId: '',
  discordUsername: '',
  address: '',
}

const DEFAULT_REQUEST_BUDGET_VALUES: RequestBudget = {
  projectTeam: [
    {
      discordUserId: '',
      discordUsername: '',
      payoutAddress: '',
      votingAddress: '',
      isRocketeer: true,
    },
    {
      discordUserId: '',
      discordUsername: '',
      payoutAddress: '',
      votingAddress: '',
      isRocketeer: false,
    },
  ],
  multisigTeam: Array(5).fill(DEFAULT_MULTISIG_TEAM),
  budget: [
    { token: '', amount: '', justification: 'dev cost' },
    { token: '', amount: '', justification: 'flex' },
  ],
}

type ProposalCache = {
  title?: string
  body?: string
  timestamp: number
}

export default function ProposalEditor() {
  const router = useRouter()

  const [signingStatus, setSigningStatus] = useState<SignStatus>('idle')
  const [attachBudget, setAttachBudget] = useState<boolean>(false)
  const [proposalTitle, setProposalTitle] = useState<string | undefined>()
  const [proposalStatus, setProposalStatus] =
    useState<ProposalStatus>('Discussion')
  const [proposalCache, setProposalCache, clearProposalCache] = useLocalStorage<ProposalCache>(
    "NanceProposalCacheV1",
    {title: undefined, body: undefined, timestamp: 0}
  );
  const [cacheModalIsOpen, setCacheModalIsOpen] = useState(
    !!(proposalCache?.title || proposalCache?.body),
  );

  // get space info to find next Snapshot Vote
  // we need this to be compliant with the proposal signing format of Snapshot
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

  // load proposal if proposalId is present (edit)
  const [{ proposalId }] = useQueryParams({ proposalId: StringParam })
  const shouldFetch = !!proposalId
  const { data } = useProposal(
    { space: NANCE_SPACE_NAME, uuid: proposalId! },
    shouldFetch
  )
  const loadedProposal = data?.data

  // request budget form
  const methods = useForm<RequestBudget>({
    mode: 'onBlur',
  })
  const { handleSubmit, reset, getValues, watch } = methods

  useEffect(() => {
    if (loadedProposal) {
      restoreFromTitleAndBody(loadedProposal.title, loadedProposal.body)
    }
  }, [loadedProposal, reset])

  function restoreFromTitleAndBody(t: string, b: string) {
    setProposalTitle(t)
    setMarkdown?.(trimActionsFromBody(b)) // dynamic load so might be undefined
    const actions = getActionsFromBody(b);
    if (!actions) return;
    console.debug('loaded action:', actions)
    setAttachBudget(true)
    reset(actions[0].payload as RequestBudget)
  }

  const onSubmit: SubmitHandler<RequestBudget> = async (formData) => {
    let proposal = buildProposal(proposalStatus)

    if (attachBudget) {
      const action: Action = {
        type: 'Request Budget',
        payload: formData,
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

  // proposal upload
  const { wallet } = useAccount()
  const { signProposalAsync } = useSignProposal(wallet)
  const { trigger } = useProposalUpload(NANCE_SPACE_NAME, loadedProposal?.uuid)
  const buttonsDisabled = !wallet?.linked || signingStatus === 'loading'

  const buildProposal = (status: ProposalStatus) => {
    return {
      title: proposalTitle,
      body: getMarkdown(),
      status,
      voteSetup: {
        type: 'quadratic', // could make this dynamic in the future
        choices: ['Yes', 'No', 'Abstain'], // could make this dynamic in the future
      },
    } as Proposal
  }

  async function signAndSendProposal(proposal: Proposal) {
    if (!proposal.title) {
      toast.error('Please enter a title for the proposal', {
        style: toastStyle,
      })
      return
    }
    if (!nextSnapshotVote) return
    setSigningStatus('loading')
    const t = toast.loading('Sign proposal...', {
      style: toastStyle
    })
    const proposalId = loadedProposal?.proposalId || nextProposalId
    const preTitle = `${proposalIdPrefix}${proposalId}: `
    signProposalAsync(proposal, preTitle, nextSnapshotVote)
      .then((res) => {
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
            if (res.success) {
              setSigningStatus('success')
              clearProposalCache();
              toast.dismiss(t)
              toast.success('Proposal submitted successfully!', {
                style: toastStyle,
              })
              // next router push
              router.push(`/proposal/${res.data.uuid}`)
            } else {
              setSigningStatus('error')
              toast.dismiss(t)
              toast.error('Error saving proposal', { style: toastStyle })
            }
          })
          .catch((error) => {
            setSigningStatus('error')
            toast.dismiss(t)
            toast.error(`[API] Error submitting proposal:\n${error}`, {
              style: toastStyle,
            })
          })
      })
      .catch((error) => {
        setSigningStatus('idle')
        toast.dismiss(t)
        toast.error(`[Wallet] Error signing proposal:\n${error}`, {
          style: toastStyle,
        })
      })
  }

  const saveProposalBodyCache = function() {
    let body = getMarkdown()

    if (attachBudget) {
      const action: Action = {
        type: 'Request Budget',
        payload: getValues(),
      }
      body = `${body}\n\n${actionsToYaml([action])}`
    }

    setProposalCache({title: proposalCache?.title || "Untitled", body: body || "", timestamp: getUnixTime(new Date())})
  }

  useEffect(() => {
      const subscription = watch((value, { name, type }) =>{
        if(type === "change") {
          saveProposalBodyCache()
        }
      })

      return () => subscription.unsubscribe()
    }, [watch])


  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn w-[90vw] md:w-full">
      <Head title='Proposal Editor' />

      <ResultModal
        title="You have saved proposal content, do you wish to restore it?"
        description={`Saved ${formatDistance(
          fromUnixTime(proposalCache?.timestamp || 0),
          new Date(),
          { addSuffix: true },
        )}. Title: ${proposalCache?.title}, Content: ${proposalCache?.body?.slice(
          0,
          140,
        )}...`}
        buttonText="Restore"
        onClick={() => {
          restoreFromTitleAndBody(proposalCache?.title || "", proposalCache?.body || "")
          setCacheModalIsOpen(false);
        }}
        cancelButtonText="Delete"
        close={() => {
          clearProposalCache();
          setCacheModalIsOpen(false);
        }}
        shouldOpen={cacheModalIsOpen}
      />

      <div className="w-full sm:w-[90%] lg:w-3/4">
        <form onSubmit={handleSubmit(onSubmit)}>
          <h1 className="page-title py-10">{loadedProposal ? 'Edit Proposal' : 'New Proposal'}</h1>
          <ProposalTitleInput value={proposalTitle} onChange={(s) => {
            setProposalTitle(s)
            const cache = proposalCache || {body: "... empty ...", timestamp: 0}
            setProposalCache({...cache, title: s})
          }} />
          <NanceEditor
            initialValue={loadedProposal?.body || TEMPLATE}
            fileUploadExternal={ async (val) => {
              const res = await pinBlobOrFile(val)
              return res.url;
            }}
            darkMode={true}
            onEditorChange={(m) => {saveProposalBodyCache()}}
          />

          <Field as="div" className="flex items-center mt-5">
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

          {attachBudget && (
            <FormProvider {...methods}>
              <div className="my-10">
                <RequestBudgetActionForm />
              </div>
            </FormProvider>
          )}

          <div className="mt-3 flex justify-end">
            {/* Submit buttons */}
            <div className="flex justify-end space-x-5">
              {/*  DRAFT */}
              <button
                type="submit"
                className={classNames(
                  buttonsDisabled && 'tooltip',
                  'text-sm px-5 py-3 border border-dashed border-moon-orange font-RobotoMono rounded-sm hover:rounded-tl-[22px] hover:rounded-br-[22px] duration-300 disabled:cursor-not-allowed disabled:hover:rounded-sm disabled:opacity-40'
                )}
                onClick={() => {
                  setProposalStatus('Draft')
                }}
                disabled={buttonsDisabled}
                data-tip={
                  signingStatus === 'loading'
                    ? 'Signing...'
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
                  'px-5 py-3 bg-moon-orange border border-transparent font-RobotoMono rounded-sm hover:rounded-tl-[22px] hover:rounded-br-[22px] duration-300 disabled:cursor-not-allowed disabled:hover:rounded-sm disabled:opacity-40'
                )}
                onClick={() => {
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
  )
}
