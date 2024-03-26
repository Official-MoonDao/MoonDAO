import { useRouter } from 'next/router'
import { useState } from 'react'
import toast from 'react-hot-toast'

export function EntityAdminModal({
  entityContract,
  tokenId,
  adminAddress,
  setEnabled,
}: any) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [newAdminAddress, setNewAdminAddress] = useState(adminAddress)
  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'entity-admin-modal-backdrop') setEnabled(false)
      }}
      id="entity-admin-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <p>
          <strong>Current Admin: </strong>
          {`${adminAddress.slice(0, 6)}...${adminAddress.slice(-4)}`}
        </p>
        <input
          className="px-2 text-black"
          placeholder="New Admin Address"
          onChange={({ target }) => setNewAdminAddress(target.value)}
        />
        <button
          className="border-2 px-4 py-2"
          disabled={isLoading}
          onClick={async () => {
            setIsLoading(true)
            if (
              newAdminAddress.length !== 42 ||
              !newAdminAddress.startsWith('0x')
            )
              return toast.error('Invalid address')

            if (newAdminAddress === adminAddress)
              return toast.error(
                'New admin address is the same as the current admin address'
              )

            try {
              await entityContract.call('setAdmin', [tokenId, newAdminAddress])
              setEnabled(false)
              router.reload()
            } catch (err) {
              toast.error(
                'Unauthorized, connect the entity admin or owner wallet.'
              )
            }
            setIsLoading(false)
          }}
        >
          {isLoading ? 'Updating...' : 'Update Admin'}
        </button>
      </div>
    </div>
  )
}
