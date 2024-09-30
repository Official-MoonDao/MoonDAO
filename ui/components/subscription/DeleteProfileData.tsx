import { usePrivy } from '@privy-io/react-auth'
import { useResolvedMediaType } from '@thirdweb-dev/react'
import { DEFAULT_CHAIN } from 'const/config'
import { useRouter } from 'next/router'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { unpin } from '@/lib/ipfs/unpin'
import { createSession, destroySession } from '@/lib/iron-session/iron-session'
import deleteResponse from '@/lib/typeform/deleteResponse'
import { getAttribute } from '@/lib/utils/nft'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'
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
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const { getAccessToken } = usePrivy()

  const resolvedMetadata = useResolvedMediaType(nft?.metadata?.uri)

  return (
    <Modal id="delete-profile-data-modal" setEnabled={setDeleteModalEnabled}>
      <div className="p-12 bg-darkest-cool rounded-md">
        <h2 className="text-xl font-bold">
          Are you sure you want to delete this data?
        </h2>
        <div className="flex justify-end mt-5">
          <StandardButton
            className="mr-2"
            onClick={() => {
              setDeleteModalEnabled(false)
            }}
          >
            Cancel
          </StandardButton>
          <PrivyWeb3Button
            requiredChain={DEFAULT_CHAIN}
            label={isLoading ? 'Loading...' : 'Delete'}
            isDisabled={isLoading}
            action={async () => {
              const accessToken = await getAccessToken()
              await createSession(accessToken)
              setIsLoading(true)

              const rawMetadataRes = await fetch(resolvedMetadata.url)
              const rawMetadata = await rawMetadataRes.json()

              //unpin image
              await unpin(rawMetadata.image.split('ipfs://')[1])

              const formResponseId = getAttribute(nft, 'formResponseId')

              try {
                let tx
                if (type === 'team') {
                  await deleteResponse(
                    process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
                    formResponseId
                  )

                  tx = await tableContract.call('updateTable', [
                    tokenId,
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                  ])
                } else if (type === 'citizen') {
                  await deleteResponse(
                    process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
                    formResponseId
                  )

                  tx = await tableContract.call('updateTable', [
                    tokenId,
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                  ])
                }

                if (tx.receipt) {
                  toast.success(
                    'Data deleted successfully, please wait for the page to reload.',
                    { duration: 10000 }
                  )
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
              await destroySession(accessToken)
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
      <StandardButton
        className="gradient-2 rounded-full"
        onClick={() => setDeleteModalEnabled(true)}
      >
        Delete Data
      </StandardButton>
    </>
  )
}
