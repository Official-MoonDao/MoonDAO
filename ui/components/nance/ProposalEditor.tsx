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
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { TEMPLATE } from '@/lib/nance'
import { NANCE_SPACE_NAME, proposalIdPrefix } from '../../lib/nance/constants'
import useAccount from '@/lib/nance/useAccountAddress'
import { useSignProposal } from '@/lib/nance/useSignProposal'
import { classNames } from '@/lib/utils/tailwind'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import Head from '@/components/layout/Head'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import ProposalTitleInput from '@/components/nance/ProposalTitleInput'
import RequestBudgetActionForm from './RequestBudgetActionForm'
import { pinBlobOrFile } from "@/lib/ipfs/pinBlobOrFile"
import { useLocalStorage } from 'react-use'
import { usePrivy } from '@privy-io/react-auth'
import { createSession, destroySession } from '@/lib/iron-session/iron-session'
type SignStatus = 'idle' | 'loading' | 'success' | 'error'

const ProposalLocalCache = dynamic(import('@/components/nance/ProposalLocalCache'), { ssr: false })

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

export type ProposalCache = {
  title?: string
  body?: string
  timestamp: number
}

export default function ProposalEditor() {
  const router = useRouter()
  const { getAccessToken } = usePrivy()

  const [signingStatus, setSigningStatus] = useState<SignStatus>('idle')
  const [attachBudget, setAttachBudget] = useState<boolean>(false)
  const [proposalTitle, setProposalTitle] = useState<string | undefined>()
  const [proposalStatus, setProposalStatus] = useState<ProposalStatus>('Discussion')


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

  const [proposalCache, setProposalCache, clearProposalCache] = useLocalStorage<ProposalCache>(`NanceProposalCacheV1-${loadedProposal?.uuid.substring(0, 5) || 'new'}`);


  const methods = useForm<RequestBudget>({
    mode: 'onBlur',
  })
  const { handleSubmit, reset, getValues, watch } = methods

  function restoreFromTitleAndBody(t: string, b: string) {
    setProposalTitle(t)
    setMarkdown?.(trimActionsFromBody(b))
    const actions = getActionsFromBody(b);
    if (!actions) return;
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
        type: 'quadratic',
        choices: ['Yes', 'No', 'Abstain'],
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

    setProposalCache({
      timestamp: getUnixTime(new Date()),
      title: proposalCache?.title || proposalTitle,
      body: body || undefined
    })
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
    <div className="flex flex-col justify-center items-start animate-fadeIn w-full md:w-full">
      <Head title='Proposal Editor' />

      <div className="px-2 w-full md:max-w-[1200px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="">
          <ProposalLocalCache
            proposalCache={proposalCache}
            clearProposalCache={clearProposalCache}
            restoreProposalCache={restoreFromTitleAndBody}
          />
          </div>
          <div className="py-0 rounded-[20px]">
          <ProposalTitleInput value={proposalTitle} onChange={(s) => {
            setProposalTitle(s)
            console.debug("setProposalTitle", s)
            const cache = proposalCache || { body: loadedProposal?.body || TEMPLATE }
            setProposalCache({ ...cache, title: s, timestamp: getUnixTime(new Date()) })
          }} />
          </div>
          <div className="pt-2 rounded-b-[0px] bg-gradient-to-b from-[#0b0c21] from-50% to-transparent to-50%">
          <NanceEditor
            initialValue={loadedProposal?.body || TEMPLATE}
            fileUploadExternal={ async (val) => {
              const accessToken = await getAccessToken()
              await createSession(accessToken)
              const res = await pinBlobOrFile(val)
              await destroySession(accessToken)
              return res.url;
            }}
            darkMode={true}
            onEditorChange={(m) => {saveProposalBodyCache()}}
          />
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
                <RequestBudgetActionForm disableRequiredFields={proposalStatus === "Draft"} />
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
                  'text-sm px-5 py-3 border border-dashed border-dark-warm font-RobotoMono rounded-[20px] duration-300 disabled:cursor-not-allowed disabled:hover:rounded-sm disabled:opacity-40'
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
                {signingStatus === 'loading' ? 'Signing...' : (proposalId ? 'Save Draft' : '* Post In Ideation Forum')}

              </button>
              {/* SUBMIT */}
              <button
                type="submit"
                className={classNames(
                  buttonsDisabled && 'tooltip',
                  'px-5 py-3 gradient-2 border border-transparent font-RobotoMono rounded-[20px] rounded-tl-[10px] duration-300 disabled:cursor-not-allowed disabled:hover:rounded-sm disabled:opacity-40'
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
          {!proposalId && (
            <p className="mt-2 text-sm text-gray-500 text-right pb-5">*Your submission will be <a href="https://discord.com/channels/914720248140279868/1027658256706961509" target="_blank" rel="noreferrer" className="text-white">posted here</a> for community discussion</p>
          )}
        </form>
      </div>
    </div>
  )
}
