import { FolderPlusIcon } from '@heroicons/react/24/solid'
import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'

export function LinkAccounts({ user }: any) {
  const [enabled, setEnabled] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState<any>({})
  const { linkWallet, linkEmail, linkPhone, linkGoogle } = usePrivy()

  function LinkAcctBtn({ onClick, linked, children }: any) {
    return (
      <button onClick={onClick}>
        <div className="flex w-full justify- gap-2">
          {children}
          <p>{linked ? '✔' : ''}</p>
        </div>
      </button>
    )
  }

  useEffect(() => {
    if (user.linkedAccounts) {
      let linkedAccounts: any = {}
      user.linkedAccounts.forEach((acc: any) => {
        console.log(acc)
        if (acc.walletClientType !== 'privy') {
          linkedAccounts[acc.type] = true
        }
      })
      setLinkedAccounts(linkedAccounts)
    }
  }, [user.linkedAccounts])

  return (
    <div className="flex flex-col gap-1">
      <button
        className="flex justify-between w-3/4"
        onClick={() => setEnabled(!enabled)}
      >
        <strong>Link Accounts</strong>
        <button
          className={`duration-300 ease-in-out ${enabled && 'rotate-180'}`}
        >
          ▼
        </button>
      </button>
      {enabled && (
        <div className="flex flex-col justify-center divide-y gap-1">
          <LinkAcctBtn onClick={linkWallet} linked={linkedAccounts?.wallet}>
            Wallet
          </LinkAcctBtn>
          <LinkAcctBtn onClick={linkEmail} linked={linkedAccounts?.email}>
            Email
          </LinkAcctBtn>
          <LinkAcctBtn onClick={linkPhone} linked={linkedAccounts?.phone}>
            Phone
          </LinkAcctBtn>
          <LinkAcctBtn onClick={linkGoogle} linked={linkedAccounts.google}>
            Google
          </LinkAcctBtn>
          <div />
        </div>
      )}
    </div>
  )
}
