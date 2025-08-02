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
    linkDiscord,
    unlinkWallet,
    unlinkPhone,
    unlinkGoogle,
    unlinkEmail,
    unlinkDiscord,
  } = usePrivy()

  function LinkAcctBtn({ link, unlink, linked, children, accountType }: any) {
    // Check if this is the only account - determine if unlinking should be disabled
    const isLastAccount =
      user.linkedAccounts &&
      user.linkedAccounts.filter((acc: any) => {
        // Filter out privy wallets and count only authentication methods
        return acc.walletClientType !== 'privy'
      }).length <= 1

    const handleUnlink = async () => {
      if (!linked) {
        link()
        return
      }

      if (!user.linkedAccounts) {
        console.error('No linked accounts found')
        return
      }

      // This check should no longer be needed since we disable the button,
      // but keeping as a safety net
      if (isLastAccount) {
        return
      }

      try {
        // Handle different account types that need specific identifiers
        if (accountType === 'discord_oauth') {
          const discordAccount = user.linkedAccounts.find(
            (acc: any) => acc.type === 'discord_oauth' || acc.type === 'discord'
          )
          if (discordAccount?.subject) {
            await unlink(discordAccount.subject)
          } else {
            console.error('Discord account subject not found', discordAccount)
            await unlink()
          }
        } else if (accountType === 'wallet') {
          const walletAccount = user.linkedAccounts.find(
            (acc: any) => acc.type === 'wallet'
          )
          if (walletAccount?.address) {
            await unlink(walletAccount.address)
          } else {
            console.error('Wallet account address not found', walletAccount)
            await unlink()
          }
        } else if (accountType === 'phone') {
          const phoneAccount = user.linkedAccounts.find(
            (acc: any) => acc.type === 'phone'
          )
          if (phoneAccount?.number) {
            await unlink(phoneAccount.number)
          } else {
            console.error('Phone account number not found', phoneAccount)
            await unlink()
          }
        } else if (accountType === 'google') {
          const googleAccount = user.linkedAccounts.find(
            (acc: any) => acc.type === 'google_oauth' || acc.type === 'google'
          )
          if (googleAccount?.subject) {
            await unlink(googleAccount.subject)
          } else {
            console.error('Google account subject not found', googleAccount)
            await unlink()
          }
        } else {
          // Fallback for other account types
          await unlink()
        }
      } catch (error: any) {
        console.error('Error unlinking account:', error)

        // Handle specific Privy errors with user-friendly messages
        if (
          error.message?.includes(
            'Cannot unlink when user has only one account'
          ) ||
          error.message?.includes('only one account')
        ) {
          console.error(
            'Attempted to unlink last account - this should be prevented by UI'
          )
        } else if (
          error.message?.includes('subject') &&
          error.message?.includes('required')
        ) {
          alert(
            'Unable to unlink account - missing account identifier. Please try refreshing the page and try again.'
          )
        } else {
          alert(
            `Failed to unlink account: ${
              error.message || 'Unknown error occurred'
            }`
          )
        }
      }
    }

    return (
      <div className="pt-1 text-[13px]">
        <div className="flex w-full items-center justify-between px-2">
          {children}
          <div className="flex gap-2">
            {linked && isLastAccount ? (
              <span className="text-gray-500 text-[11px]">Only method</span>
            ) : (
              <button
                onClick={handleUnlink}
                className={
                  linked && isLastAccount ? 'opacity-50 cursor-not-allowed' : ''
                }
                disabled={linked && isLastAccount}
              >
                <p>{linked ? 'Unlink' : 'Add'}</p>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    console.log('LINKED ACCOUNTS', user.linkedAccounts)
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
            link={linkDiscord}
            unlink={unlinkDiscord}
            linked={linkedAccounts?.discord_oauth}
            accountType="discord_oauth"
          >
            Discord:
          </LinkAcctBtn>
          <LinkAcctBtn
            link={linkWallet}
            unlink={unlinkWallet}
            linked={linkedAccounts?.wallet}
            accountType="wallet"
          >
            Wallet:
          </LinkAcctBtn>
          <LinkAcctBtn
            link={linkPhone}
            unlink={unlinkPhone}
            linked={linkedAccounts?.phone}
            accountType="phone"
          >
            SMS:
          </LinkAcctBtn>
          <LinkAcctBtn
            link={linkGoogle}
            unlink={unlinkGoogle}
            linked={linkedAccounts.google}
            accountType="google"
          >
            Google:
          </LinkAcctBtn>
          <div />
        </div>
      )}
    </div>
  )
}
