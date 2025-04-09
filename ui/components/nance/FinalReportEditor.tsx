import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { useProposal } from '@nance/nance-hooks'
import { RequestBudget } from '@nance/nance-sdk'
import ProjectsABI from 'const/abis/Project.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  DEFAULT_CHAIN_V5,
  PROJECT_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
} from 'const/config'
import { StringParam, useQueryParams } from 'next-query-params'
import dynamic from 'next/dynamic'
import { useContext, useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { FINAL_REPORT_TEMPLATE } from '@/lib/nance'
import { NANCE_SPACE_NAME } from '@/lib/nance/constants'
import { Project } from '@/lib/project/useProjectData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { classNames } from '@/lib/utils/tailwind'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import Head from '@/components/layout/Head'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import ProposalTitleInput from '@/components/nance/ProposalTitleInput'
import ProjectsDropdown from '@/components/project/ProjectsDropdown'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import EditorMarkdownUpload from './EditorMarkdownUpload'

type SignStatus = 'idle' | 'loading' | 'success' | 'error'

type FinalReportEditorProps = {
  projectsWithoutReport: Project[] | undefined
}

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

export default function FinalReportEditor({
  projectsWithoutReport,
}: FinalReportEditorProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const address = account?.address

  //Contracts
  const projectContract = useContract({
    address: PROJECT_ADDRESSES[chainSlug],
    abi: ProjectsABI,
    chain: selectedChain,
  })

  const projectTableContract = useContract({
    address: PROJECT_TABLE_ADDRESSES[chainSlug],
    abi: ProjectTableABI,
    chain: selectedChain,
  })

  const [signingStatus, setSigningStatus] = useState<SignStatus>('idle')

  const [{ proposalId }, setQuery] = useQueryParams({ proposalId: StringParam })
  const shouldFetch = !!proposalId
  const { data } = useProposal(
    { space: NANCE_SPACE_NAME, uuid: proposalId! },
    shouldFetch
  )
  const [loadedProposal, setLoadedProposal] = useState<any>(undefined)

  useEffect(() => {
    if (projectsWithoutReport) {
      setLoadedProposal(
        projectsWithoutReport.find((p: any) => p.MDP === Number(proposalId))
          ? data?.data
          : undefined
      )
    }
  }, [projectsWithoutReport, data, proposalId])

  const reportTitle = loadedProposal?.title
    ? loadedProposal?.title + ' Final Report'
    : ''

  const [selectedProject, setSelectedProject] = useState<Project | undefined>()
  const [isManager, setIsManager] = useState<boolean>(false)

  useEffect(() => {
    async function checkIsManager() {
      try {
        const results = await Promise.allSettled([
          readContract({
            contract: projectContract,
            method: 'isManager' as string,
            params: [selectedProject?.id, address],
          }),
          readContract({
            contract: projectContract,
            method: 'ownerOf' as string,
            params: [selectedProject?.id],
          }),
        ])

        const manager: any =
          results[0].status === 'fulfilled' ? results[0].value : false
        const owner: any =
          results[1].status === 'fulfilled' ? results[1].value : false

        setIsManager(manager || owner === address)
      } catch (err) {
        setIsManager(false)
      }
    }
    if (address && projectContract) {
      checkIsManager()
    }
  }, [selectedProject, address, projectContract])

  useEffect(() => {
    if (projectsWithoutReport) {
      setSelectedProject(
        projectsWithoutReport.find((p) => p.MDP === loadedProposal?.proposalId)
      )
    }
  }, [projectsWithoutReport, loadedProposal])

  const methods = useForm<RequestBudget>({
    mode: 'onBlur',
  })
  const { handleSubmit } = methods

  const onSubmit: SubmitHandler<RequestBudget> = async (formData) => {
    console.debug('formData', formData)

    if (!reportTitle || !loadedProposal) {
      return toast.error('Please select a project that you are a manager of.', {
        style: toastStyle,
      })
    }

    setSigningStatus('loading')

    try {
      const markdown = getMarkdown()
      if (!markdown) {
        throw new Error('No markdown found')
      }
      if (!account) {
        throw new Error('No account found')
      }
      const header = `# ${reportTitle}\n\n`
      const fileName = `${reportTitle.replace(/\s+/g, '-')}.md`
      const file = new File([header + markdown], fileName, {
        type: 'text/markdown',
      })

      const { cid: markdownIpfsHash } = await pinBlobOrFile(file)

      const projectsTableName = await readContract({
        contract: projectTableContract,
        method: 'getTableName' as string,
        params: [],
      })
      const statement = `SELECT * FROM ${projectsTableName} WHERE MDP = ${loadedProposal?.proposalId}`
      const projectRes = await fetch(
        `/api/tableland/query?statement=${statement}`
      )
      const projectData = await projectRes.json()
      const project = projectData[0]

      const transaction = prepareContractCall({
        contract: projectTableContract,
        method: 'updateFinalReportIPFS' as string,
        params: [project.id, 'ipfs://' + markdownIpfsHash],
      })
      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })
      if (receipt) {
        setSelectedProject(undefined)
        setMarkdown(FINAL_REPORT_TEMPLATE)
        setLoadedProposal(undefined)
        setQuery({ proposalId: undefined })

        toast.success('Final report uploaded successfully.', {
          style: toastStyle,
        })
        setSigningStatus('success')
      }
    } catch (err) {
      console.log(err)
      toast.error('Unable to upload final report, please contact support.', {
        style: toastStyle,
      })
      setSigningStatus('error')
    }
    setTimeout(() => {
      setSigningStatus('idle')
    }, 5000)
  }

  const buttonsDisabled =
    !address || signingStatus === 'loading' || !isManager || !selectedProject

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
              <ProjectsDropdown
                projects={projectsWithoutReport}
                setProposalId={setProposalId}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
              />
              <EditorMarkdownUpload setMarkdown={setMarkdown} />
            </div>
          </div>
          <div className="pt-0 rounded-t-[20px] rounded-b-[0px] bg-dark-cool">
            <NanceEditor
              initialValue={FINAL_REPORT_TEMPLATE}
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
              <PrivyWeb3Button
                requiredChain={DEFAULT_CHAIN_V5}
                className="rounded-[20px] rounded-tl-[10px] px-5 py-3 gradient-2 border border-transparent font-RobotoMono duration-300 disabled:cursor-not-allowed disabled:hover:rounded-sm disabled:opacity-40"
                label={signingStatus === 'loading' ? 'Signing...' : 'Submit'}
                action={onSubmit}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
