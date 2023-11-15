import { useState } from 'react'
import toast from 'react-hot-toast'
import { useExportPrivyWallet } from '../../lib/privy/hooks/useExportPrivyWallet'

type ExportPrivyWalletModalProps = {
  setEnabled: Function
}

export function ExportPrivyWalletModal({
  setEnabled,
}: ExportPrivyWalletModalProps) {
  const [delegateAddress, setDelegateAddress] = useState<string>('')
  const exportPrivyWallet = useExportPrivyWallet(delegateAddress)

  return (
    <div
      onClick={(e: any) => {
        if (e.target.id === 'export-privy-wallet-modal-backdrop')
          setEnabled(false)
      }}
      id="export-privy-wallet-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-[300px] h-[350px] md:w-[500px] md:h-[300px] p-8 bg-background-light dark:bg-background-dark rounded-md">
        <h1 className="text-2xl">Export Privy Wallet</h1>
        <p className="opacity-50">
          {
            'Please enter the address of the wallet that you would like to send your tokens and voting power to.'
          }
        </p>
        <label>Wallet Address : </label>
        <input
          className="text-black rounded-sm px-2"
          onChange={(e) => setDelegateAddress(e.target.value)}
        />
        <div className="flex w-full justify-between pt-8">
          <button
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={() => {
              if (delegateAddress.length < 42)
                return toast.error('Please enter a valid address.')
              exportPrivyWallet()
            }}
          >
            Export
          </button>
          <button
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-[#2A2A2A] text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={() => setEnabled(false)}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
