import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { useProposal, useProposalUpload } from '@nance/nance-hooks'
import { RequestBudget } from '@nance/nance-sdk'
import { getUnixTime } from 'date-fns'
import { StringParam, useQueryParams } from 'next-query-params'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useLocalStorage } from 'react-use'
import { NANCE_SPACE_NAME } from '../../lib/nance/constants'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { TEMPLATE } from '@/lib/nance'
import useAccount from '@/lib/nance/useAccountAddress'
import { useSignProposal } from '@/lib/nance/useSignProposal'
import ChainContext from '@/lib/thirdweb/chain-context'
import { classNames } from '@/lib/utils/tailwind'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import Head from '@/components/layout/Head'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import ProposalTitleInput from '@/components/nance/ProposalTitleInput'
import ActiveProjectsDropdown from './ActiveProjectsDropdown'

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
export type FinalReportCache = {
  title?: string
  body?: string
  timestamp: number
}

export default function FinalReportEditor() {
  const router = useRouter()
  const { selectedChain } = useContext(ChainContext)

  const [signingStatus, setSigningStatus] = useState<SignStatus>('idle')

  const [{ proposalId }, setQuery] = useQueryParams({ proposalId: StringParam })
  const shouldFetch = !!proposalId
  const { data } = useProposal(
    { space: NANCE_SPACE_NAME, uuid: proposalId! },
    shouldFetch
  )
  const loadedProposal = data?.data

  const [reportCache, setReportCache, clearReportCache] =
    useLocalStorage<FinalReportCache>(
      `NanceFinalReportCacheV1-${loadedProposal?.uuid.substring(0, 5)}`
    )
  const [reportTitle, setReportTitle] = useState(loadedProposal?.title)
  const methods = useForm<RequestBudget>({
    mode: 'onBlur',
  })
  const { handleSubmit, reset, getValues, watch } = methods

  function restoreFromTitleAndBody(t: string, b: string) {
    setReportTitle(t)
    setMarkdown?.(b)
  }

  useEffect(() => {
    if (loadedProposal) {
      console.log(reportCache)
      restoreFromTitleAndBody(
        loadedProposal.title,
        reportCache?.body || TEMPLATE
      )
    }
  }, [loadedProposal, proposalId])

  const onSubmit: SubmitHandler<RequestBudget> = async (formData) => {
    console.debug('formData', formData)
  }

  const { wallet } = useAccount()
  const { signProposalAsync } = useSignProposal(wallet)
  const { trigger } = useProposalUpload(NANCE_SPACE_NAME, loadedProposal?.uuid)
  const buttonsDisabled = !wallet?.linked || signingStatus === 'loading'

  const saveProposalBodyCache = function () {
    let body = getMarkdown()

    setReportCache({
      timestamp: getUnixTime(new Date()),
      title: reportTitle || reportCache?.title || loadedProposal?.title,
      body: body || undefined,
    })
  }

  const setProposalId = function (id: string) {
    setQuery({ proposalId: id })
  }

  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      if (type === 'change') {
        saveProposalBodyCache()
      }
    })

    return () => subscription.unsubscribe()
  }, [watch])

  const [reportBody, setReportBody] = useState(reportCache?.body)

  useEffect(() => {
    setReportBody(reportCache?.body)
  }, [reportBody, reportCache])

  useEffect(() => {
    console.log(reportBody)
  }, [reportBody])

  return (
    <div className="flex flex-col justify-center items-start animate-fadeIn w-[90vw] md:w-full">
      <Head title="Final Report Editor" />

      <div className="px-5 pt-2 w-full md:max-w-[1200px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-5 pb-0 bg-dark-cool">
            <ProposalLocalCache
              proposalCache={reportCache}
              clearProposalCache={clearReportCache}
              restoreProposalCache={restoreFromTitleAndBody}
            />
          </div>
          <div className="w-full p-5 py-0 rounded-[20px] bg-dark-cool flex justify-end">
            <ProposalTitleInput
              value={reportTitle || reportCache?.title || loadedProposal?.title}
              onChange={(s) => {
                console.debug('setReportTitle', s)
                const cache = reportCache || {
                  body: TEMPLATE,
                }
                setReportCache({
                  ...cache,
                  title: s,
                  timestamp: getUnixTime(new Date()),
                })
              }}
            />
            <ActiveProjectsDropdown
              selectedChain={selectedChain}
              setProposalId={setProposalId}
            />
          </div>
          <div className="p-5 pt-0 p-5 pt-0 rounded-t-[20px] rounded-b-[0px] bg-dark-cool">
            <NanceEditor
              key={reportCache?.body}
              initialValue={reportCache?.body}
              fileUploadExternal={async (val) => {
                const res = await pinBlobOrFile(val)
                return res.url
              }}
              darkMode={true}
              onEditorChange={(m) => {
                saveProposalBodyCache()
              }}
            />
          </div>

          <div className="p-5 rounded-b-[20px] rounded-t-[0px] bg-dark-cool"></div>

          <div className="mt-3 flex justify-end">
            {/* Submit buttons */}
            <div className="flex justify-end space-x-5">
              {/* SUBMIT */}
              <button
                type="submit"
                className={classNames(
                  buttonsDisabled && 'tooltip',
                  'px-5 py-3 gradient-2 border border-transparent font-RobotoMono rounded-[20px] rounded-tl-[10px] duration-300 disabled:cursor-not-allowed disabled:hover:rounded-sm disabled:opacity-40'
                )}
                onClick={() => {}}
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
