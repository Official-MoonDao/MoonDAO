import { GetMarkdown, SetMarkdown } from '@nance/nance-editor'
import { RequestBudget } from '@nance/nance-sdk'
import ProjectsABI from 'const/abis/Project.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import { DEFAULT_CHAIN_V5, PROJECT_ADDRESSES, PROJECT_TABLE_ADDRESSES } from 'const/config'
import { StringParam, useQueryParams } from 'next-query-params'
import dynamic from 'next/dynamic'
import { useContext, useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { prepareContractCall, readContract, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { FINAL_REPORT_TEMPLATE } from '@/lib/nance'
import { Project } from '@/lib/project/useProjectData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
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
  projectsFromLastQuarter: Project[] | undefined
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

export default function FinalReportEditor({ projectsFromLastQuarter }: FinalReportEditorProps) {
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

  const [selectedProject, setSelectedProject] = useState<Project | undefined>()
  const [isManager, setIsManager] = useState<boolean>(false)

  const reportTitle = selectedProject?.name ? selectedProject?.name + ' Final Report' : ''
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

        const manager: any = results[0].status === 'fulfilled' ? results[0].value : false
        const owner: any = results[1].status === 'fulfilled' ? results[1].value : false

        setIsManager(manager || owner === address)
      } catch (err) {
        setIsManager(false)
      }
    }
    if (address && projectContract) {
      checkIsManager()
    }
  }, [selectedProject, address, projectContract])

  const methods = useForm<RequestBudget>({
    mode: 'onBlur',
  })
  const { handleSubmit } = methods

  const onSubmit: SubmitHandler<RequestBudget> = async (formData) => {
    console.debug('FinalReport.onSubmit called', {
      formData,
      reportTitle,
      selectedProjectId: selectedProject?.id,
      isManager,
      address: address?.slice(0, 6) + '...' + address?.slice(-4),
    })

    // Validation checks
    if (!reportTitle) {
      console.error('FinalReport: Missing project selection')
      return toast.error('Please select a project that you are a manager of.', {
        style: toastStyle,
      })
    }

    if (!selectedProject?.id) {
      console.error('FinalReport: No selected project ID')
      return toast.error('Please select a valid project.', {
        style: toastStyle,
      })
    }

    if (!isManager) {
      console.error('FinalReport: User is not a manager')
      return toast.error('You must be a manager or owner of the selected project.', {
        style: toastStyle,
      })
    }

    const markdown = getMarkdown()
    if (!markdown || markdown.trim().length === 0) {
      console.error('FinalReport: No content provided')
      return toast.error('Please write some content for your final report.', {
        style: toastStyle,
      })
    }

    if (!account) {
      console.error('FinalReport: No account found')
      return toast.error('Please connect your wallet to submit the report.', {
        style: toastStyle,
      })
    }

    setSigningStatus('loading')

    try {
      const header = `# ${reportTitle}\n\n`
      const fileName = `${reportTitle.replace(/\s+/g, '-')}.md`
      const file = new File([header + markdown], fileName, {
        type: 'text/markdown',
      })
      const { cid: markdownIpfsHash } = await pinBlobOrFile(file)

      // Update the project with final report IPFS hash
      const transaction = prepareContractCall({
        contract: projectTableContract,
        method: 'updateFinalReportIPFS' as string,
        params: [selectedProject.id, 'ipfs://' + markdownIpfsHash],
      })

      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })


      if (receipt) {
        // Reset form state
        setSelectedProject(undefined)
        setMarkdown(FINAL_REPORT_TEMPLATE)

        toast.success('Final report uploaded successfully.', {
          style: toastStyle,
        })
        setSigningStatus('success')
      }
    } catch (err: any) {
      console.error('FinalReport: Submission failed:', err)

      let errorMessage = 'Unable to upload final report, please contact support.'
      if (err.message?.includes('IPFS')) {
        errorMessage = 'Failed to upload report to IPFS. Please try again.'
      } else if (err.message?.includes('Project not found')) {
        errorMessage = 'Project not found in database. Please contact support.'
      } else if (err.message?.includes('transaction')) {
        errorMessage = 'Transaction failed. Please check your wallet and try again.'
      } else if (err.message?.includes('fetch project data')) {
        errorMessage = 'Failed to fetch project data. Please try again.'
      }

      toast.error(errorMessage, {
        style: toastStyle,
      })
      setSigningStatus('error')
    }

    setTimeout(() => {
      setSigningStatus('idle')
    }, 5000)
  }

  const buttonsDisabled = !address || signingStatus === 'loading' || !isManager || !selectedProject


  const handleFormSubmit = async () => {
    // Use react-hook-form's handleSubmit to trigger validation
    await handleSubmit(onSubmit)()
  }

  const getButtonDisabledReason = () => {
    if (!address) return 'Please connect your wallet'
    if (signingStatus === 'loading') return 'Processing transaction...'
    if (!selectedProject) return 'Please select a project'
    if (!isManager) return 'You must be a project manager'
    if (isUploadingImage) return 'Uploading image...'
    return null
  }

  const [isUploadingImage, setIsUploadingImage] = useState(false)

  return (
    <div className="flex flex-col justify-center items-start animate-fadeIn w-[90vw] md:w-full">
      <Head title="Final Report Editor" />

      <div className="pt-2 w-full md:max-w-[1200px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="w-full py-0 rounded-[20px] flex justify-between items-start gap-4">
            <div className="mb-4 flex-shrink-0 w-2/3">
              <ProposalTitleInput
                value={reportTitle}
                onChange={(s) => {
                  console.debug('setReportTitle', s)
                }}
              />
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0 w-1/3 mb-4">
              <ProjectsDropdown
                projects={projectsFromLastQuarter}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
              />
              <EditorMarkdownUpload setMarkdown={setMarkdown} />
            </div>
          </div>
          <div className="pt-0 rounded-t-[20px] rounded-b-[0px] bg-dark-cool relative">
            <NanceEditor
              initialValue={FINAL_REPORT_TEMPLATE}
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
              onEditorChange={(m) => {}}
            />
            {isUploadingImage && (
              <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 rounded-b-[0px]">
                <img
                  src="/assets/MoonDAO-Loading-Animation.svg"
                  alt="Uploading..."
                  className="w-16 h-16 mb-4"
                />
                <p className="text-white text-lg font-medium">Uploading image to IPFS...</p>
                <p className="text-gray-300 text-sm mt-2">Please wait, do not close this window</p>
              </div>
            )}
          </div>

          <div className="p-5 rounded-b-[20px] rounded-t-[0px] bg-dark-cool"></div>

          <div className="mt-6 flex flex-col gap-4">
            {/* Project Manager Requirement Disclaimer */}
            {address && selectedProject && !isManager && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-red-400 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-red-400 mb-1">
                      Manager Access Required
                    </h3>
                    <p className="text-sm text-red-200/80">
                      You must be a manager or owner of the selected project to submit a final
                      report. Please select a project you manage or contact the project owner to add
                      you as a manager.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* No Project Selected Disclaimer */}
            {address && !selectedProject && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-blue-400 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-400 mb-1">Select a Project</h3>
                    <p className="text-sm text-blue-200/80">
                      Please select a project from the dropdown above to submit your final report.
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                  <h3 className="text-sm font-semibold text-yellow-400 mb-1">Network Notice</h3>
                  <p className="text-sm text-yellow-200/80">
                    Please ensure you're connected to the correct blockchain network before
                    submitting. You may need to switch networks in your wallet to complete your
                    submission successfully.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit buttons */}
            <div className="flex flex-col items-end space-y-2">
              <PrivyWeb3Button
                requiredChain={DEFAULT_CHAIN_V5}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-xl transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
                label={
                  signingStatus === 'loading'
                    ? 'Signing...'
                    : isUploadingImage
                    ? 'Uploading image...'
                    : 'Submit Final Report'
                }
                action={handleFormSubmit}
                isDisabled={buttonsDisabled || isUploadingImage}
              />
              {(buttonsDisabled || isUploadingImage) && getButtonDisabledReason() && (
                <p className="text-sm text-yellow-400 font-medium">{getButtonDisabledReason()}</p>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
