import { useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { useRouter } from 'next/router'
import { useContext, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
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
  const router = useRouter()
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { user, authenticated } = usePrivy()
  const { login } = useLogin({
    onComplete: (user, isNewUser, wasAlreadyAuthenticated) => {
      const isLoggingInViaWeb3Button = router.query.loggingInViaWeb3Button === 'true'
      if (user && !wasAlreadyAuthenticated && isLoggingInViaWeb3Button) {
        const { loggingInViaWeb3Button, ...restQuery } = router.query
        router.replace(
          {
            query: restQuery,
          },
          undefined,
          { shallow: true }
        )
        action && action()
      }
    },
    onError(error) {
      const { loggingInViaWeb3Button, ...restQuery } = router.query
      router.replace(
        {
          query: restQuery,
        },
        undefined,
        { shallow: true }
      )
    },
  })
  const { wallets } = useWallets()

  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const isProcessingRef = useRef(false)

  const [btnState, setBtnState] = useState(0)

  useEffect(() => {
    const chainId = selectedChain?.id
    const requiredChainId = requiredChain?.id

    if (!user) {
      setBtnState(0)
    } else if (!skipNetworkCheck && chainId !== +wallets[selectedWallet]?.chainId.split(':')[1]) {
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
          onClick={async () => {
            await router.replace(
              {
                query: {
                  ...router.query,
                  loggingInViaWeb3Button: true,
                },
              },
              undefined,
              { shallow: true }
            )
            login()
          }}
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
            if (isProcessingRef.current || isProcessing) {
              return
            }
            isProcessingRef.current = true
            flushSync(() => {
              setIsProcessing(true)
              setIsLoading(true)
            })
            try {
              const targetChain = requiredChain || selectedChain
              if (requiredChain) {
                setSelectedChain(requiredChain)
              }

              const success = await addNetworkToWallet(targetChain)
              if (success) {
                await wallets[selectedWallet]?.switchChain(targetChain?.id)

                const maxAttempts = 50
                const pollInterval = 100
                let attempts = 0

                while (attempts < maxAttempts) {
                  await new Promise((resolve) => setTimeout(resolve, pollInterval))
                  const currentChainId = +wallets[selectedWallet]?.chainId?.split(':')[1]
                  if (currentChainId === targetChain.id) {
                    break
                  }
                  attempts++
                }
              }
            } catch (err: any) {
              console.error('Error switching network:', err.message)
            } finally {
              setIsLoading(false)
              setIsProcessing(false)
              isProcessingRef.current = false
            }
          }}
          isDisabled={isDisabled || isLoading || isProcessing}
          noPadding={noPadding}
          noGradient={noGradient}
        >
          {isLoading ? (
            <div className="w-full flex justify-center items-center">
              <LoadingSpinner width="w-5" height="h-5" />
            </div>
          ) : (
            'Switch Network'
          )}
        </Button>
      )}
      {btnState === 2 && (
        <Button
          id={id}
          dataTestId={dataTestId}
          type={type}
          className={className}
          onClick={async () => {
            if (isProcessingRef.current || isProcessing) {
              return
            }
            isProcessingRef.current = true
            flushSync(() => {
              setIsProcessing(true)
              setIsLoading(true)
            })
            try {
              await action()
              onSuccess && onSuccess()
            } catch (err: any) {
              console.log(err.message)
              onError && onError()
            } finally {
              setIsLoading(false)
              setIsProcessing(false)
              isProcessingRef.current = false
            }
          }}
          isDisabled={isDisabled || isLoading || isProcessing}
          noPadding={noPadding}
          noGradient={noGradient}
        >
          {isLoading ? (
            <div className="w-full flex justify-center items-center">
              <LoadingSpinner width="w-5" height="h-5" />
            </div>
          ) : (
            label
          )}
        </Button>
      )}
    </>
  )
}
