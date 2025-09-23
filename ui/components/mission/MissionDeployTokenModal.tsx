import { XMarkIcon } from '@heroicons/react/20/solid'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import { JBV5_CONTROLLER_ADDRESS } from 'const/config'
import { ethers } from 'ethers'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { keccak256 } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { toUtf8Bytes } from 'ethers/lib/utils'
import FormInput from '../forms/FormInput'
import ConditionCheckbox from '../layout/ConditionCheckbox'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export type MissionDeployTokenModalProps = {
  setEnabled: (enabled: boolean) => void
  chainSlug: string
  isTeamSigner: boolean
  queueSafeTx: any
  lastSafeTxExecuted: boolean | null
  mission: any
  teamMutlisigAddress: string
}

export default function MissionDeployTokenModal({
  setEnabled,
  chainSlug,
  isTeamSigner,
  queueSafeTx,
  lastSafeTxExecuted,
  mission,
  teamMutlisigAddress,
}: MissionDeployTokenModalProps) {
  const router = useRouter()
  const account = useActiveAccount()

  const [agreedToTokenNotSecurity, setAgreedToTokenNotSecurity] =
    useState(false)

  const [sentTxToSafe, setSentTxToSafe] = useState(false)

  const [token, setToken] = useState({
    name: '',
    symbol: '',
  })

  async function deployToken() {
    if (!account) {
      console.error('No account available')
      return
    }

    if (!isTeamSigner) {
      toast.error("You are not a signer of the team's multisig", {
        style: toastStyle,
      })
      return
    }

    if (!agreedToTokenNotSecurity) {
      toast.error('Please accept the token security disclaimer', {
        style: toastStyle,
      })
      return
    }

    if (
      !token.name ||
      !token.symbol ||
      token.name.trim().length === 0 ||
      token.symbol.trim().length === 0
    ) {
      toast.error('Please enter a token name and symbol', {
        style: toastStyle,
      })
      return
    }

    try {
      const iface = new ethers.utils.Interface(JBV5Controller.abi)
      const txData = iface.encodeFunctionData('deployERC20For', [
        mission?.projectId,
        token.name,
        token.symbol,
        keccak256(toUtf8Bytes(`${mission?.projectId}-${Date.now()}`)),
      ])
      await queueSafeTx({
        to: JBV5_CONTROLLER_ADDRESS,
        data: txData,
        value: '0',
        safeTxGas: '1000000',
      })
      setSentTxToSafe(true)
    } catch (error) {
      toast.error('Error deploying token', {
        style: toastStyle,
      })
      console.error('Error deploying token:', error)
    }
  }

  useEffect(() => {
    if (lastSafeTxExecuted) {
      router.reload()
    }
  }, [lastSafeTxExecuted])

  return (
    <Modal id="mission-deploy-token-modal" setEnabled={setEnabled}>
      <div className="mt-12 w-screen h-full rounded-[2vmax] max-w-full md:max-w-[800px] flex flex-col gap-4 items-start justify-start p-5 bg-gradient-to-b from-dark-cool to-darkest-cool">
        <div className="w-full flex gap-4 items-start justify-between">
          <h3 className="text- font-GoodTimes">{`Deploy Token`}</h3>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <p>{`Please enter the name and symbol for your mission token.`}</p>
        <div>
          <FormInput
            id="mission-token-name"
            label="Token Name"
            placeholder="Enter a token name"
            value={token.name}
            onChange={(e: any) =>
              setToken({
                ...token,
                name: e.target.value,
              })
            }
            maxLength={32}
            mode="dark"
            tooltip="The name for your mission token (e.g.: Ethereum, Bitcoin)."
          />
        </div>
        <div>
          <FormInput
            id="mission-token-symbol"
            label="Token Symbol"
            placeholder="Enter a token symbol"
            value={token.symbol}
            onChange={(e: any) =>
              setToken({
                ...token,
                symbol: e.target.value.toUpperCase(),
              })
            }
            maxLength={8}
            mode="dark"
            tooltip="The symbol for your mission token (e.g.: ETH, BTC)."
          />
        </div>
        <ConditionCheckbox
          id="token-security-checkbox"
          label={
            <p>
              I ACKNOWLEDGE THAT THIS TOKEN IS NOT A SECURITY, CARRIES NO PROFIT
              EXPECTATION, AND I ACCEPT ALL{' '}
              <Link
                className="text-blue-500 hover:underline"
                href="https://docs.moondao.com/Launchpad/Launchpad-Disclaimer"
                target="_blank"
                rel="noreferrer"
              >
                RISKS
              </Link>{' '}
              ASSOCIATED WITH PARTICIPATION IN THE MOONDAO LAUNCHPAD.
            </p>
          }
          agreedToCondition={agreedToTokenNotSecurity}
          setAgreedToCondition={setAgreedToTokenNotSecurity}
        />
        <PrivyWeb3Button
          className="rounded-full"
          label="Deploy Token"
          action={deployToken}
          isDisabled={
            sentTxToSafe ||
            !agreedToTokenNotSecurity ||
            token.name.trim().length === 0 ||
            token.symbol.trim().length === 0
          }
        />
        {sentTxToSafe && (
          <p className="">
            {
              "Please follow the link to execute the transaction from your team's "
            }
            <Link
              href={`https://app.safe.global/transactions/history?safe=${
                process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
              }:${teamMutlisigAddress}`}
              className="text-light-warm font-bold underline"
              target="_blank"
              rel="noreferrer"
            >
              Safe
            </Link>
            {'.'}
          </p>
        )}
      </div>
    </Modal>
  )
}
