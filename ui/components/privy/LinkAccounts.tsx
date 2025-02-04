import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'

export function LinkAccounts({ user }: any) {
  const [enabled, setEnabled] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState<any>({})
  const {
    linkWallet,
    linkEmail,
    linkPhone,
    linkGoogle,
    unlinkWallet,
    unlinkPhone,
    unlinkGoogle,
    unlinkEmail,
  } = usePrivy()

  function LinkAcctBtn({ link, unlink, linked, children }: any) {
    return (
      <div className="pt-1 text-[13px]">
        <div className="flex w-full items-center justify-between px-2">
          {children}
          <div className="flex gap-2">
            <button onClick={linked ? unlink : link}>
              <p>{linked ? 'Unlink' : 'Add'}</p>
            </button>
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (user.linkedAccounts) {
      let linkedAccounts: any = {}
      user.linkedAccounts.forEach((acc: any) => {
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
        <strong>Link Accounts:</strong>
        <button
          className={`duration-150 ease-in-out ${enabled && 'rotate-180'}`}
        >
          <ChevronDownIcon height={20} width={20} />
        </button>
      </button>
      {enabled && (
        <div className="flex flex-col justify-center divide-y gap-1">
          <LinkAcctBtn
            link={linkWallet}
            unlink={unlinkWallet}
            linked={linkedAccounts?.wallet}
          >
            Wallet:
          </LinkAcctBtn>
          <LinkAcctBtn
            link={linkPhone}
            unlink={unlinkPhone}
            linked={linkedAccounts?.phone}
          >
            SMS:
          </LinkAcctBtn>
          <LinkAcctBtn
            link={linkGoogle}
            unlink={unlinkGoogle}
            linked={linkedAccounts.google}
          >
            Google:
          </LinkAcctBtn>
          <div />
        </div>
      )}
    </div>
  )
}
