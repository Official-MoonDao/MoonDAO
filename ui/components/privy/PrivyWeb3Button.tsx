import { usePrivy, useWallets } from '@privy-io/react-auth'
import { getChainByChainIdAsync } from '@thirdweb-dev/chains'
import { useContext, useEffect, useState } from 'react'
import { defineChain } from 'thirdweb'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import ChainContext from '../../lib/thirdweb/chain-context'
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
}

function Button({
  id,
  type = 'button',
  className,
  onClick,
  isDisabled,
  children,
}: any) {
  return (
    <button
      id={id}
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
}: PrivyWeb3BtnProps) {
  const { selectedChain, setSelectedChain } = useContext(ChainContext)
  const {
    selectedChain: selectedChainV5,
    setSelectedChain: setSelectedChainV5,
  } = useContext(ChainContextV5)

  const { selectedWallet } = useContext(PrivyWalletContext)
  const { user, login } = usePrivy()
  const { wallets } = useWallets()

  const [isLoading, setIsLoading] = useState(false)

  const [btnState, setBtnState] = useState(0)

  useEffect(() => {
    const chainId = v5 ? selectedChainV5.id : selectedChain.chainId
    const requiredChainId = v5 ? requiredChain?.id : requiredChain?.chainId

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
  }, [wallets, selectedChain, selectedWallet, user, skipNetworkCheck, v5])

  return (
    <>
      {btnState === 0 && (
        <Button id={id} className={className} onClick={login}>
          Connect
        </Button>
      )}
      {btnState === 1 && (
        <Button
          id={id}
          type="button"
          className={className}
          onClick={async () => {
            const chain = v5 ? selectedChainV5 : selectedChain
            if (requiredChain && requiredChain !== chain) {
              const chainId = v5 ? requiredChain.id : requiredChain.chainId
              const v4Chain = await getChainByChainIdAsync(chainId)
              const v5Chain = defineChain(chainId)
              setSelectedChain(v4Chain)
              setSelectedChainV5(v5Chain)
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
          id={id}
          type={type}
          className={className}
          onClick={async () => {
            console.log(requiredChain, v5)
            setIsLoading(true)
            try {
              await action()
              onSuccess && onSuccess()
            } catch (err: any) {
              console.log(err)
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
