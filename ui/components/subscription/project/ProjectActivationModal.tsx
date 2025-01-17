import { DEFAULT_CHAIN } from 'const/config'
import { useRouter } from 'next/router'
import { useState } from 'react'
import Modal from '@/components/layout/Modal'
import StandardButton from '@/components/layout/StandardButton'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'

export default function ProjectActivationModal({
  projectId,
  projectContract,
  isActive,
  setEnabled,
}: any) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  return (
    <Modal id="delete-profile-data-modal" setEnabled={setEnabled}>
      <div className="p-12 bg-darkest-cool rounded-md">
        <h2 className="text-xl font-bold">
          {`Are you sure you want to ${
            isActive ? 'deactivate' : 'activate'
          } this project?`}
        </h2>
        <div className="flex justify-end mt-5">
          <StandardButton
            className="mr-2"
            onClick={() => {
              setEnabled(false)
            }}
          >
            Cancel
          </StandardButton>
          <PrivyWeb3Button
            requiredChain={DEFAULT_CHAIN}
            label={
              isLoading ? 'Loading...' : isActive ? 'Deactivate' : 'Activate'
            }
            isDisabled={isLoading || !projectContract}
            action={async () => {
              setIsLoading(true)
              if (isActive) {
                //deactivate
                await projectContract?.call('updateActive', [projectId, 0])
              } else {
                //activate
                await projectContract?.call('updateActive', [projectId, 1])
              }

              setTimeout(() => {
                setIsLoading(false)
                router.reload()
              }, 15000)
            }}
          />
        </div>
      </div>
    </Modal>
  )
}
