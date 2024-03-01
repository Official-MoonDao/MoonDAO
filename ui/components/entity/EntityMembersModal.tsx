import { PlusCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { Polygon } from '@thirdweb-dev/chains'
import { useAddress } from '@thirdweb-dev/react'
import { BigNumber } from 'ethers'
import { useContext, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'

type EnitityMembersModalProps = {
  setEnabled: Function
  updateEntityMembers: Function
}

export function EntityMembersModal({
  setEnabled,
  updateEntityMembers,
}: EnitityMembersModalProps) {
  const currMemberRef = useRef<any>()
  const [newMembers, setNewMembers] = useState<string[]>([])

  return (
    <div
      onClick={(e: any) => {
        if (e.target.id === 'submit-tts-info-modal-backdrop') setEnabled(false)
      }}
      id="submit-tts-info-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl">Add Members</h1>
        <div className="w-full flex gap-4">
          <input
            className="px-2 text-black w-[300px]"
            type="text"
            ref={currMemberRef}
          />
          <button
            onClick={() => {
              const currMember = currMemberRef.current.value
              if (currMember.length != 42 || !currMember.startsWith('0x'))
                return toast.error('Invalid address')
              if (newMembers.includes(currMember))
                return toast.error('Member already added')
              setNewMembers((prev) => [...prev, currMember])
            }}
          >
            <PlusCircleIcon className="h-12 w-12" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {newMembers.map((member) => (
            <>
              <div
                key={member}
                className="flex items-center justify-between text-[80%]"
              >
                <p>{member}</p>
                <button
                  className="hover:scale-110 duration-300"
                  onClick={() =>
                    setNewMembers((prev) => prev.filter((m) => m != member))
                  }
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <hr className="border-1"></hr>
            </>
          ))}
        </div>
        <button className="border-2 p-2">Add Members</button>
      </div>
    </div>
  )
}
