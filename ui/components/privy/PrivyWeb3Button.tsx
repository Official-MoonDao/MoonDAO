import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'

/*
Button States:
0 = Connect Wallet
1 = Switch Network
2 = Action
*/

type PrivyWeb3BtnProps = {
  id?: string
  label: any
  type?: string
  action: Function
  isDisabled?: boolean
  className?: string
  onSuccess?: Function
  onError?: Function
  skipNetworkCheck?: boolean
  requiredChain?: any
  v5?: boolean
  noPadding?: boolean
}

function Button({
  id,
  type = 'button',
  className,
  onClick,
  isDisabled,
  children,
  noPadding = false,
}: any) {
  return (
    <button
      id={id}
      type={type}
      className={`${
        noPadding ? '' : 'px-5 py-3'
      } text-lg gradient-2 text-white disabled:opacity-50 ${className}`}
      onClick={onClick}
      disabled={isDisabled}
    >
      {children}
    </button>
  )
}

export function PrivyWeb3Button({
  id,
  label,
  type = 'button',
  action,
  isDisabled = false,
  className = '',
  onSuccess,
  onError,
  skipNetworkCheck = false,
  requiredChain,
  v5 = false,
  noPadding = false,
}: PrivyWeb3BtnProps) {
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { user, login } = usePrivy()
  const { wallets } = useWallets()

  const [isLoading, setIsLoading] = useState(false)

  const [btnState, setBtnState] = useState(0)

  useEffect(() => {
    const chainId = selectedChain?.id
    const requiredChainId = requiredChain?.id

    if (!user) {
      setBtnState(0)
    } else if (
      !skipNetworkCheck &&
      chainId !== +wallets[selectedWallet]?.chainId.split(':')[1]
    ) {
      setBtnState(1)
    } else if (
      !skipNetworkCheck &&
      requiredChain &&
      requiredChainId !== +wallets[selectedWallet]?.chainId.split(':')[1]
    ) {
      setBtnState(1)
    } else {
      setBtnState(2)
    }

    if (process.env.NEXT_PUBLIC_TEST_ENV === 'true') {
      setBtnState(2)
    }
  }, [
    wallets,
    selectedChain,
    selectedWallet,
    user,
    skipNetworkCheck,
    requiredChain,
    v5,
  ])

  return (
    <>
      {btnState === 0 && (
        <Button
          id={id}
          className={className}
          onClick={login}
          noPadding={noPadding}
        >
          Connect
        </Button>
      )}
      {btnState === 1 && (
        <Button
          id={id}
          type="button"
          className={className}
          onClick={async () => {
            if (requiredChain) {
              setSelectedChain(requiredChain)
            }

            try {
              await wallets[selectedWallet]?.switchChain(selectedChain?.id)
            } catch (err: any) {
              console.log(err.message)
            }
          }}
          isDisabled={isDisabled}
          noPadding={noPadding}
        >
          Switch Network
        </Button>
      )}
      {btnState === 2 && (
        <Button
          id={id}
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
          noPadding={noPadding}
        >
          {isLoading ? 'loading...' : label}
        </Button>
      )}
    </>
  )
}
