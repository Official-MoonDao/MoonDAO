import React from 'react'
import { useWaitForTransaction } from 'wagmi'
import usePreferredNetwork from '../lib/use-preferred-network'
import { useAccount, useNetwork } from '../lib/use-wagmi'
import ActionNeedsTokenApproval from './ActionNeedsTokenApproval'
import useTranslation from 'next-translate/useTranslation';

export default function ActionButton({
  className,
  children,
  action,
  preAction,
  postAction,
  approval,
}: any) {
  const { data: account } = useAccount()
  const { writeAsync, data, isLoadingOverride } = action
  const { isLoading } = useWaitForTransaction({
    hash: data?.hash,
  })
  const onClick = async () => {
    preAction && preAction()
    const tx = await writeAsync()
    tx?.wait && (await tx.wait())
    postAction && postAction()
  }

  const { activeChain } = useNetwork({})
  const { isPreferredNetwork } = usePreferredNetwork()

  const { t } = useTranslation('common');

  return (
    <>
      {!isPreferredNetwork ? (
        <button id="redButton" className={className} disabled>
          {!activeChain?.id ? t('notConnected') : t('wrongNetwork')}
        </button>
      ) : !account ? (
        <label htmlFor="web3-modal" className={`${className} modal-button`}>
          {children}
        </label>
      ) : isLoading || isLoadingOverride ? (
        <div className={className}>
          <button className="btn btn-square btn-link btn-disabled bg-transparent loading"></button>
        </div>
      ) : approval ? (
        <ActionNeedsTokenApproval
          className={className}
          action={action}
          preAction={preAction}
          {...approval}
        >
          {children}
        </ActionNeedsTokenApproval>
      ) : (
        <div className={className} onClick={onClick}>
          {children}
        </div>
      )}
    </>
  )
}
