import {
  AdjustmentsHorizontalIcon,
  CheckIcon,
  DocumentIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { NFT, useAddress } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { useState } from 'react'
import Frame from '@/components/layout/Frame'
import SlidingCardMenu from '@/components/layout/SlidingCardMenu'
import Action from '../Action'
import ProjectActivationModal from './ProjectActivationModal'
import ProjectEligibilityModal from './ProjectEligibilityModal'

type ProjectActionsProps = {
  nft: NFT | undefined
  projectContract: any
  isActive: boolean
  isManager: boolean
  hasFinalReport: boolean
}

export default function ProjectActions({
  nft,
  projectContract,
  isActive,
  isManager,
  hasFinalReport,
}: ProjectActionsProps) {
  const router = useRouter()
  const address = useAddress()

  const [projectActivationModalEnabled, setProjectActivationModalEnabled] =
    useState(false)
  const [projectEligibilityModalEnabled, setProjectEligibilityModalEnabled] =
    useState(false)

  return (
    <div id="citizen-actions-container" className="py-5 md:px-5 md:py-0 z-30">
      {true ? (
        <>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pr-12">
            <div className="flex gap-5 opacity-[50%]">
              <h2 className="header font-GoodTimes">Next Steps</h2>
            </div>
          </div>
          <div className="px-5 pt-5 md:px-0 md:pt-0">
            <Frame
              noPadding
              marginBottom="0px"
              bottomRight="2vmax"
              topRight="2vmax"
              topLeft="10px"
              bottomLeft="2vmax"
            >
              <SlidingCardMenu>
                <div className="flex gap-5">
                  {!hasFinalReport && (
                    <Action
                      title="Submit Final Report"
                      description="Complete your profile by adding a bio, social links, or your location."
                      icon={<DocumentIcon height={30} width={30} />}
                      onClick={() => router.push('/submit?tab=report')}
                    />
                  )}
                  {isActive ? (
                    <Action
                      title="De-activate Project"
                      description="De-activate your project if it is no longer active."
                      icon={<XMarkIcon height={30} width={30} />}
                      onClick={() => {
                        setProjectActivationModalEnabled(true)
                      }}
                    />
                  ) : (
                    <Action
                      title="Activate Project"
                      description="Activate your project."
                      icon={<CheckIcon height={30} width={30} />}
                      onClick={() => {
                        setProjectActivationModalEnabled(true)
                      }}
                    />
                  )}
                  <Action
                    title="Change Eligibility"
                    description="Adjust the eligibility of your project."
                    icon={<AdjustmentsHorizontalIcon height={30} width={30} />}
                    onClick={() => {
                      setProjectEligibilityModalEnabled(true)
                    }}
                  />
                </div>
              </SlidingCardMenu>
            </Frame>
          </div>
          {projectActivationModalEnabled && (
            <ProjectActivationModal
              projectId={nft?.metadata.id}
              projectContract={projectContract}
              isActive={isActive}
              setEnabled={setProjectActivationModalEnabled}
            />
          )}
          {projectEligibilityModalEnabled && (
            <ProjectEligibilityModal
              setEnabled={setProjectEligibilityModalEnabled}
            />
          )}
        </>
      ) : (
        <></>
      )}
    </div>
  )
}
