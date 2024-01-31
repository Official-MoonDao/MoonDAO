import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Chain } from '@thirdweb-dev/chains'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import ChainContext from '../../lib/thirdweb/chain-context'

/*
Button States:
0 = Connect Wallet
1 = Switch Network
2 = Action
*/

type PrivyWeb3BtnProps = {
  label: string
  action: Function
  isDisabled?: boolean
  className?: string
  onSuccess?: Function
  onError?: Function
  skipNetworkCheck?: boolean
}

export function PrivyWeb3Button({
  label,
  action,
  isDisabled = false,
  className = '',
  onSuccess,
  onError,
  skipNetworkCheck = false,
}: PrivyWeb3BtnProps) {
  const { selectedChain, setSelectedChain } = useContext(ChainContext)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { user, login } = usePrivy()
  const { wallets } = useWallets()

  const [isLoading, setIsLoading] = useState(false)

  const [btnState, setBtnState] = useState(0)

  function Button({ onClick, children }: any) {
    return (
      <button
        // className={`px-8 py-2 w-[200px] rounded-md text-black ${className}`}
        className={`p-2 rounded-md text-black min-w-[200px] ${className}`}
        onClick={onClick}
        disabled={isDisabled}
      >
        {children}
      </button>
    )
  }
  useEffect(() => {
    if (!user) {
      setBtnState(0)
    } else if (
      !skipNetworkCheck &&
      selectedChain.chainId !== +wallets[selectedWallet]?.chainId.split(':')[1]
    ) {
      setBtnState(1)
    } else {
      setBtnState(2)
    }
  }, [wallets, selectedChain, selectedWallet, user])

  return (
    <>
      {btnState === 0 && <Button onClick={login}>Connect</Button>}
      {btnState === 1 && (
        <Button
          onClick={async () => {
            try {
              await wallets[selectedWallet]?.switchChain(selectedChain.chainId)
            } catch (err: any) {
              console.log(err.message)
            }
          }}
        >
          Switch Network
        </Button>
      )}
      {btnState === 2 && (
        <Button
          onClick={async () => {
            setIsLoading(true)
            try {
              await action()
              onSuccess && onSuccess()
            } catch (err: any) {
              console.log(err.message)
              onError && onError()
            }
            setIsLoading(false)
          }}
          disabled={isDisabled}
        >
          {isLoading ? 'loading...' : label}
        </Button>
      )}
    </>
  )
}
