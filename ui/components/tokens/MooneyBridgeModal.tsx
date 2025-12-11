import { useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { MOONEY_ADDRESSES } from '../../const/config'

type SubmitInfoModalProps = {
  setEnabled: (enabled: boolean) => void
}

export function MooneyBridgeModal({ setEnabled }: SubmitInfoModalProps) {
  const account = useActiveAccount()
  const address = account?.address

  const [bridgeAmount, setBridgeAmount] = useState(0)
  const [ethToMatic, setEthToMatic] = useState(true)

  const parentMooneyAddress =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
      ? MOONEY_ADDRESSES['ethereum']
      : MOONEY_ADDRESSES['goerli']
  const childMooneyAddress =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
      ? MOONEY_ADDRESSES['polygon']
      : MOONEY_ADDRESSES['mumbai']

  return (
    <div
      onClick={(e: any) => {
        if (e.target.id === 'submit-tts-info-modal-backdrop') setEnabled(false)
      }}
      id="submit-tts-info-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-[300px] md:w-[500px] p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl text-white"></h1>
      </div>
    </div>
  )
}
