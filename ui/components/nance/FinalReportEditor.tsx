import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { useProposal } from '@nance/nance-hooks'
import { RequestBudget } from '@nance/nance-sdk'
import { useAddress, useContract } from '@thirdweb-dev/react'
import HatsABI from 'const/abis/Hats.json'
import ProjectsABI from 'const/abis/Project.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  HATS_ADDRESS,
  PROJECT_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
} from 'const/config'
import { StringParam, useQueryParams } from 'next-query-params'
import dynamic from 'next/dynamic'
import { useContext, useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { NANCE_SPACE_NAME } from '../../lib/nance/constants'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { FINAL_REPORT_TEMPLATE } from '@/lib/nance'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import ChainContext from '@/lib/thirdweb/chain-context'
import { classNames } from '@/lib/utils/tailwind'
import '@nance/nance-editor/lib/css/dark.css'
import '@nance/nance-editor/lib/css/editor.css'
import Head from '@/components/layout/Head'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import ProposalTitleInput from '@/components/nance/ProposalTitleInput'
import ProjectsDropdown from '@/components/project/ProjectsDropdown'
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
  const { selectedChain } = useContext(ChainContext)
  const address = useAddress()

  //Contracts
  const { contract: projectContract } = useContract(
    PROJECT_ADDRESSES[selectedChain.slug],
    ProjectsABI
  )
  const { contract: hatsContract } = useContract(HATS_ADDRESS, HatsABI)

  const [signingStatus, setSigningStatus] = useState<SignStatus>('idle')

  const { contract: projectsTableContact } = useContract(
    PROJECT_TABLE_ADDRESSES[selectedChain.slug],
    ProjectTableABI
  )

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
  const { isManager } = useProjectData(
    projectContract,
    hatsContract,
    selectedProject
  )

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

    try {
      const markdown = getMarkdown()
      if (!markdown) {
        throw new Error('No markdown found')
      }
      const header = `# ${reportTitle}\n\n`
      const fileName = `${reportTitle.replace(/\s+/g, '-')}.md`
      const file = new File([header + markdown], fileName, {
        type: 'text/markdown',
      })

      const { cid: markdownIpfsHash } = await pinBlobOrFile(file)

      const projectsTableName = await projectsTableContact?.call('getTableName')
      const statement = `SELECT * FROM ${projectsTableName} WHERE MDP = ${loadedProposal?.proposalId}`
      const projectRes = await fetch(
        `${TABLELAND_ENDPOINT}?statement=${statement}`
      )
      const projectData = await projectRes.json()
      const project = projectData[0]

      await projectsTableContact?.call('updateFinalReportIPFS', [
        project.id,
        'ipfs://' + markdownIpfsHash,
      ])
      setSelectedProject(undefined)
      setMarkdown(FINAL_REPORT_TEMPLATE)
      setLoadedProposal(undefined)
      setQuery({ proposalId: undefined })

      toast.success('Final report uploaded successfully.', {
        style: toastStyle,
      })
    } catch (err) {
      console.log(err)
      toast.error('Unable to upload final report, please contact support.', {
        style: toastStyle,
      })
    }
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
              <button
                type="submit"
                className={classNames(
                  buttonsDisabled && 'tooltip',
                  'px-5 py-3 gradient-2 border border-transparent font-RobotoMono rounded-[20px] rounded-tl-[10px] duration-300 disabled:cursor-not-allowed disabled:hover:rounded-sm disabled:opacity-40'
                )}
                onClick={() => {}}
                disabled={buttonsDisabled || !projectsTableContact}
                data-tip={
                  !selectedProject
                    ? 'Please select a project.'
                    : !isManager
                    ? 'You are not a manager.'
                    : signingStatus === 'loading'
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
