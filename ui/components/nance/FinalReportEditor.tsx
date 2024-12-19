import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { useProposal, useProposalUpload } from '@nance/nance-hooks'
import { RequestBudget } from '@nance/nance-sdk'
import { getAccessToken } from '@privy-io/react-auth'
import { useAddress, useContract } from '@thirdweb-dev/react'
import ProjectsABI from 'const/abis/Project.json'
import { PROJECT_TABLE_ADDRESSES, TABLELAND_ENDPOINT } from 'const/config'
import { StringParam, useQueryParams } from 'next-query-params'
import dynamic from 'next/dynamic'
import { useContext, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { NANCE_SPACE_NAME } from '../../lib/nance/constants'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { createSession, destroySession } from '@/lib/iron-session/iron-session'
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
import EditorMarkdownUpload from './EditorMarkdownUpload'

type SignStatus = 'idle' | 'loading' | 'success' | 'error'

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

export default function FinalReportEditor() {
  const { selectedChain } = useContext(ChainContext)
  const address = useAddress()

  const [signingStatus, setSigningStatus] = useState<SignStatus>('idle')

  const { contract: projectsTableContact } = useContract(
    PROJECT_TABLE_ADDRESSES[selectedChain.slug],
    ProjectsABI
  )

  const [{ proposalId }, setQuery] = useQueryParams({ proposalId: StringParam })
  const shouldFetch = !!proposalId
  const { data } = useProposal(
    { space: NANCE_SPACE_NAME, uuid: proposalId! },
    shouldFetch
  )
  const loadedProposal = data?.data
  const reportTitle = loadedProposal
    ? loadedProposal?.title + ' Final Report'
    : ''

  const methods = useForm<RequestBudget>({
    mode: 'onBlur',
  })
  const { handleSubmit, reset, getValues, watch } = methods

  const onSubmit: SubmitHandler<RequestBudget> = async (formData) => {
    console.debug('formData', formData)
    //check if connected wallet is a rocketeer of the proposal
    const teamMembers = loadedProposal?.actions?.[0]?.payload?.projectTeam
    if (
      !teamMembers.some(
        (m: any) =>
          (m.payoutAddress === address || m.votingAddress === address) &&
          m.isRocketeer === true
      )
    ) {
      return toast.error('You are not a rocketeer of this proposal.', {
        style: toastStyle,
      })
    }

    const accessToken = await getAccessToken()
    await createSession(accessToken)
    try {
      const markdown = getMarkdown()
      if (!markdown) {
        throw new Error('No markdown found')
      }
      const blob = new Blob([markdown], { type: 'text/markdown' })
      // const { cid: markdownIpfsHash } = await pinBlobOrFile(blob)
      const projectsTableName = await projectsTableContact?.call('getTableName')
      const statement = `SELECT * FROM ${projectsTableName} WHERE MDP = ${loadedProposal?.proposalId}`
      const projectRes = await fetch(
        `${TABLELAND_ENDPOINT}?statement=${statement}`
      )
      const projectData = await projectRes.json()
      console.log(projectData)
      // await projectsTableContact?.call('updateTable', [])
    } catch (err) {
      toast.error('Unable to upload final report, please contact support.', {
        style: toastStyle,
      })
    }
    await destroySession(accessToken)
  }

  const { wallet } = useAccount()
  const { signProposalAsync } = useSignProposal(wallet)
  const { trigger } = useProposalUpload(NANCE_SPACE_NAME, loadedProposal?.uuid)
  const buttonsDisabled = !address || signingStatus === 'loading'

  const setProposalId = function (id: string) {
    setQuery({ proposalId: id })
  }

  return (
    <div className="flex flex-col justify-center items-start animate-fadeIn w-[90vw] md:w-full">
      <Head title="Final Report Editor" />

      <div className="pt-2 w-full md:max-w-[1200px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="w-full py-0 rounded-[20px] flex justify-end">
            <ProposalTitleInput
              value={reportTitle}
              onChange={(s) => {
                console.debug('setReportTitle', s)
              }}
            />
            <div className="flex flex-col gap-2">
              <ActiveProjectsDropdown
                selectedChain={selectedChain}
                setProposalId={setProposalId}
              />
              <EditorMarkdownUpload setMarkdown={setMarkdown} />
            </div>
          </div>
          <div className="pt-0 rounded-t-[20px] rounded-b-[0px] bg-dark-cool">
            <NanceEditor
              initialValue={TEMPLATE}
              fileUploadExternal={async (val) => {
                const res = await pinBlobOrFile(val)
                return res.url
              }}
              darkMode={true}
              onEditorChange={(m) => {}}
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
                disabled={buttonsDisabled || !projectsTableContact}
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
