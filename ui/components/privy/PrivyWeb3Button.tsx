import { useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { addNetworkToWallet } from '@/lib/thirdweb/addNetworkToWallet'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { LoadingSpinner } from '../layout/LoadingSpinner'

/*
Button States:
0 = Connect Wallet
1 = Switch Network
2 = Action
*/

type PrivyWeb3BtnProps = {
  id?: string
  dataTestId?: string
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
  noGradient?: boolean
  showSignInLabel?: boolean
}

function Button({
  id,
  dataTestId,
  type = 'button',
  className,
  onClick,
  isDisabled,
  children,
  noPadding = false,
  noGradient = false,
}: any) {
  return (
    <button
      id={id}
      data-testid={dataTestId}
      type={type}
      className={`${noPadding ? '' : 'px-5 py-3'} text-lg ${
        noGradient ? '' : 'gradient-2'
      } text-white disabled:opacity-50 ${className}`}
      onClick={onClick}
      disabled={isDisabled}
    >
      {children}
    </button>
  )
}

export function PrivyWeb3Button({
  id,
  dataTestId,
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
  noGradient = false,
  showSignInLabel = false,
}: PrivyWeb3BtnProps) {
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { user, authenticated } = usePrivy()
  const { login } = useLogin({
    onComplete: (user, isNewUser, wasAlreadyAuthenticated) => {
      if (user && !wasAlreadyAuthenticated) {
        action && action()
      }
    },
  })
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
    authenticated,
    skipNetworkCheck,
    requiredChain,
    v5,
  ])

  return (
    <>
      {btnState === 0 && (
        <Button
          id={id}
          dataTestId={dataTestId}
          className={className}
          onClick={login}
          noPadding={noPadding}
          noGradient={noGradient}
        >
          {showSignInLabel ? 'Sign In' : label}
        </Button>
      )}
      {btnState === 1 && (
        <Button
          id={id}
          dataTestId={dataTestId}
          type="button"
          className={className}
          onClick={async () => {
            if (requiredChain) {
              setSelectedChain(requiredChain)
            }

            try {
              const success = await addNetworkToWallet(selectedChain)
              if (success) {
                await wallets[selectedWallet]?.switchChain(selectedChain?.id)
              }
            } catch (err: any) {
              console.error('Error switching network:', err.message)
            }
          }}
          isDisabled={isDisabled}
          noPadding={noPadding}
          noGradient={noGradient}
        >
          Switch Network
        </Button>
      )}
      {btnState === 2 && (
        <Button
          id={id}
          dataTestId={dataTestId}
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
          noGradient={noGradient}
        >
          {isLoading ? (
            <div className="w-full">
              <LoadingSpinner />
            </div>
          ) : (
            label
          )}
        </Button>
      )}
    </>
  )
}
