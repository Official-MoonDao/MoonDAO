import { usePrivy, useWallets } from '@privy-io/react-auth'
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
  label: any
  type?: string
  action: Function
  isDisabled?: boolean
  className?: string
  onSuccess?: Function
  onError?: Function
  skipNetworkCheck?: boolean
  requiredChain?: any
}

function Button({
  type = 'button',
  className,
  onClick,
  isDisabled,
  children,
}: any) {
  return (
    <button
      type={type}
      // className={`px-8 py-2 w-[200px] rounded-md text-black ${className}`}
      className={`px-5 py-3 text-lg gradient-2 text-white disabled:opacity-50 ${className}`}
      onClick={onClick}
      disabled={isDisabled}
    >
      {children}
    </button>
  )
}

export function PrivyWeb3Button({
  label,
  type = 'button',
  action,
  isDisabled = false,
  className = '',
  onSuccess,
  onError,
  skipNetworkCheck = false,
  requiredChain,
}: PrivyWeb3BtnProps) {
  const { selectedChain, setSelectedChain } = useContext(ChainContext)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { user, login } = usePrivy()
  const { wallets } = useWallets()

  const [isLoading, setIsLoading] = useState(false)

  const [btnState, setBtnState] = useState(0)

  useEffect(() => {
    if (!user) {
      setBtnState(0)
    } else if (
      !skipNetworkCheck &&
      selectedChain.chainId !== +wallets[selectedWallet]?.chainId.split(':')[1]
    ) {
      setBtnState(1)
    } else if (
      requiredChain &&
      requiredChain.chainId !== +wallets[selectedWallet]?.chainId.split(':')[1]
    ) {
      setBtnState(1)
    } else {
      setBtnState(2)
    }
  }, [wallets, selectedChain, selectedWallet, user, skipNetworkCheck])

  return (
    <>
      {btnState === 0 && (
        <Button className={className} onClick={login}>
          Connect
        </Button>
      )}
      {btnState === 1 && (
        <Button
          type="button"
          className={className}
          onClick={async () => {
            if (requiredChain && requiredChain !== selectedChain) {
              setSelectedChain(requiredChain)
            }

            try {
              await wallets[selectedWallet]?.switchChain(selectedChain.chainId)
            } catch (err: any) {
              console.log(err.message)
            }
          }}
          isDisabled={isDisabled}
        >
          Switch Network
        </Button>
      )}
      {btnState === 2 && (
        <Button
          type={type}
          className={className}
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
          isDisabled={isDisabled || isLoading}
        >
          {isLoading ? 'loading...' : label}
        </Button>
      )}
    </>
  )
}
