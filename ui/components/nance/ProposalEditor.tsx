import { Field, Label, Switch } from '@headlessui/react'
import { GetMarkdown } from '@nance/nance-editor'
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
import { add, differenceInDays } from 'date-fns'
import { StringParam, useQueryParams } from 'next-query-params'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import toastStyle from '../../lib/marketplace/marketplace-utils/toastConfig'
import { TEMPLATE } from '../../lib/nance'
import { NANCE_SPACE_NAME, proposalIdPrefix } from '../../lib/nance/constants'
import useAccount from '../../lib/nance/useAccountAddress'
import { useSignProposal } from '../../lib/nance/useSignProposal'
import { classNames } from '../../lib/utils/tailwind'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import Head from '../../components/layout/Head'
import { LoadingSpinner } from '../../components/layout/LoadingSpinner'
import ProposalTitleInput, {
  TITLE_ID,
} from '../../components/nance/ProposalTitleInput'
import RequestBudgetActionForm from './RequestBudgetActionForm'

type SignStatus = 'idle' | 'loading' | 'success' | 'error'

// Nance Editor
let getMarkdown: GetMarkdown

const NanceEditor = dynamic(
  async () => {
    getMarkdown = (await import('@nance/nance-editor')).getMarkdown
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

export default function ProposalEditor() {
  const router = useRouter()

  const [signingStatus, setSigningStatus] = useState<SignStatus>('idle')
  const [attachBudget, setAttachBudget] = useState<boolean>(false)
  const [proposalStatus, setProposalStatus] =
    useState<ProposalStatus>('Discussion')

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
  const { handleSubmit, reset } = methods

  useEffect(() => {
    // will need to refactor if we want to support multiple actions
    if (loadedProposal) {
      const actions = getActionsFromBody(loadedProposal?.body);
      if (!actions) return;
      console.debug('loaded action:', actions)
      setAttachBudget(true)
      reset(actions[0].payload as RequestBudget)
    }
  }, [loadedProposal, reset])

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

  const fileUploadIPFS = {
    gateway: process.env.NEXT_PUBLIC_INFURA_IPFS_GATEWAY as string,
    auth: `Basic ${Buffer.from(
      `${process.env.NEXT_PUBLIC_INFURA_IPFS_ID}:${process.env.NEXT_PUBLIC_INFURA_IPFS_SECRET}`
    ).toString('base64')}`,
  }

  const buildProposal = (status: ProposalStatus) => {
    const title = (document?.getElementById(TITLE_ID) as HTMLInputElement).value
    return {
      title,
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
              toast.success('Proposal submitted successfully!', {
                style: toastStyle,
              })
              // next router push
              router.push(`/proposal/${res.data.uuid}`)
            } else {
              setSigningStatus('error')
              toast.error('Error saving draft', { style: toastStyle })
            }
          })
          .catch((error) => {
            setSigningStatus('error')
            toast.error(`[API] Error submitting proposal:\n${error}`, {
              style: toastStyle,
            })
          })
      })
      .catch((error) => {
        setSigningStatus('idle')
        toast.error(`[Wallet] Error signing proposal:\n${error}`, {
          style: toastStyle,
        })
      })
  }

  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn">
      <Head title='Proposal Editor' />

      <div className="w-full sm:w-[90%] lg:w-3/4">
        <form onSubmit={handleSubmit(onSubmit)}>
          <h1 className="page-title py-10">{loadedProposal ? 'Edit Proposal' : 'New Proposal'}</h1>
          <ProposalTitleInput initialValue={loadedProposal?.title} />
          <NanceEditor
            initialValue={trimActionsFromBody(loadedProposal?.body) || TEMPLATE}
            fileUploadIPFS={fileUploadIPFS}
            darkMode={true}
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
