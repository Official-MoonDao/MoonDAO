import { DEFAULT_CHAIN_V5 } from 'const/config'
import { useRouter } from 'next/router'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { unpinCitizenImage, unpinTeamImage } from '@/lib/ipfs/unpin'
import deleteResponse from '@/lib/typeform/deleteResponse'
import { getAttribute } from '@/lib/utils/nft'
import StandardButton from '../layout/StandardButton'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type DeleteProfileDataProps = {
  nft: any
  setEnabled: (enabled: boolean) => void
  tableContract: any
  tokenId: any
  type: string
}

export default function DeleteProfileData({
  nft,
  setEnabled,
  tableContract,
  tokenId,
  type,
}: DeleteProfileDataProps) {
  const account = useActiveAccount()
  const router = useRouter()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
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
        setEnabled(false)
        router.reload()
      }, 15000)
    } catch (err) {
      console.log(err)
    }
    setIsLoading(false)
  }

  if (showConfirmation) {
    return (
      <div className="w-full bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          Are you sure you want to delete this data?
        </h3>
        <p className="text-white/70 text-sm mb-4">
          This action cannot be undone. All profile data will be permanently deleted.
        </p>
        <div className="flex gap-3">
          <StandardButton
            className="flex-1"
            onClick={() => setShowConfirmation(false)}
            disabled={isLoading}
          >
            Cancel
          </StandardButton>
          <PrivyWeb3Button
            v5
            requiredChain={DEFAULT_CHAIN_V5}
            label={isLoading ? 'Deleting...' : 'Delete'}
            isDisabled={isLoading}
            action={handleDelete}
            className="flex-1"
          />
        </div>
      </div>
    )
  }

  return (
    <StandardButton className="gradient-2 rounded-full" onClick={() => setShowConfirmation(true)}>
      Delete Data
    </StandardButton>
  )
}
