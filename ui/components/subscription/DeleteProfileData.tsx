import { DEFAULT_CHAIN_V5 } from 'const/config'
import { useRouter } from 'next/router'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { unpinCitizenImage, unpinTeamImage } from '@/lib/ipfs/unpin'
import deleteResponse from '@/lib/typeform/deleteResponse'
import { getAttribute } from '@/lib/utils/nft'
import Button from '../layout/Button'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type DeleteProfileDataProps = {
  nft: any
  setEnabled: Function
  tableContract: any
  tokenId: any
  type: string
}

type DeleteProfileDataModalProps = {
  nft: any
  setParentModalEnabled: Function
  setDeleteModalEnabled: Function
  tableContract: any
  tokenId: any
  type: string
}

function DeleteProfileDataModal({
  nft,
  setParentModalEnabled,
  setDeleteModalEnabled,
  tableContract,
  tokenId,
  type,
}: DeleteProfileDataModalProps) {
  const account = useActiveAccount()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  return (
    <Modal id="delete-profile-data-modal" setEnabled={setDeleteModalEnabled}>
      <div className="p-12 bg-darkest-cool rounded-md">
        <h2 className="text-xl font-bold">Are you sure you want to delete this data?</h2>
        <div className="flex justify-end mt-5">
          <Button
            className="mr-2"
            onClick={() => {
              setDeleteModalEnabled(false)
            }}
          >
            Cancel
          </Button>
          <PrivyWeb3Button
            requiredChain={DEFAULT_CHAIN_V5}
            label={isLoading ? 'Loading...' : 'Delete'}
            isDisabled={isLoading}
            action={async () => {
              setIsLoading(true)

              const formResponseId = getAttribute(nft, 'formResponseId')?.value

              try {
                let transaction
                if (type === 'team') {
                  await unpinTeamImage(tokenId)

                  await deleteResponse(
                    process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
                    formResponseId
                  )

                  transaction = prepareContractCall({
                    contract: tableContract,
                    method: 'updateTableDynamic' as string,
                    params: [
                      tokenId,
                      [
                        'name',
                        'description',
                        'image',
                        'twitter',
                        'communications',
                        'website',
                        'view',
                        'formId',
                      ],
                      ['', '', '', '', '', '', '', '', ''],
                    ],
                  })
                } else if (type === 'citizen') {
                  await unpinCitizenImage(tokenId)

                  await deleteResponse(
                    process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
                    formResponseId
                  )

                  transaction = prepareContractCall({
                    contract: tableContract,
                    method: 'updateTableDynamic' as string,
                    params: [
                      tokenId,
                      [
                        'name',
                        'description',
                        'image',
                        'location',
                        'discord',
                        'twitter',
                        'website',
                        'view',
                        'formId',
                      ],
                      ['', '', '', '', '', '', '', '', ''],
                    ],
                  })
                }

                if (!transaction || !account) return

                const receipt = await sendAndConfirmTransaction({
                  transaction,
                  account,
                })

                if (receipt) {
                  toast.success('Data deleted successfully, please wait for the page to reload.', {
                    duration: 10000,
                  })
                }

                setTimeout(() => {
                  setDeleteModalEnabled(false)
                  setParentModalEnabled(false)
                  router.reload()
                }, 15000)
              } catch (err) {
                console.log(err)
              }
              setIsLoading(false)
            }}
          />
        </div>
      </div>
    </Modal>
  )
}

export default function DeleteProfileData({
  nft,
  setEnabled,
  tableContract,
  tokenId,
  type,
}: DeleteProfileDataProps) {
  const [deleteModalEnabled, setDeleteModalEnabled] = useState(false)
  return (
    <>
      {deleteModalEnabled && (
        <DeleteProfileDataModal
          nft={nft}
          setDeleteModalEnabled={setDeleteModalEnabled}
          setParentModalEnabled={setEnabled}
          tableContract={tableContract}
          tokenId={tokenId}
          type={type}
        />
      )}
      <Button
        variant="gradient"
        borderRadius="rounded-full"
        className="gradient-2"
        onClick={() => setDeleteModalEnabled(true)}
      >
        Delete Data
      </Button>
    </>
  )
}
