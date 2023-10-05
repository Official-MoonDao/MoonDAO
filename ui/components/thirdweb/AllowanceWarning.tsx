import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { useAddress } from '@thirdweb-dev/react'
import { BigNumber } from 'ethers'
import useTranslation from 'next-translate/useTranslation'
import { useTokenAllowance, useTokenApproval } from '../../lib/tokens/approve'

interface AllowanceWarningProps {
  tokenContract: any
  spender: string
}

export const AllowanceWarning = ({
  tokenContract,
  spender,
}: AllowanceWarningProps) => {
  const address = useAddress()
  const { data: tokenAllowance, isLoading: tokenAllowanceLoading } =
    useTokenAllowance(tokenContract, address, spender)

  const { mutateAsync: revokeAllowance } = useTokenApproval(
    tokenContract,
    BigNumber.from('0'),
    undefined,
    spender
  )

  const { t } = useTranslation('common')

  return (
    <div className="mt-8 pt-1 pb-3 lg:px-8 xl:px-4 xl:py-3 flex flex-col xl:flex-row xl:items-center items-center component-background px-4 border border-amber-400 dark:border-detail-dark rounded-xl">
      <div>
        <ExclamationCircleIcon className="h-7 w-7 md:h-9 md:w-9 xl:h-12 xl:w-12 text-red-400" />
      </div>

      <p className=" md:mt-1 text-sm text-center block xl:text-left xl:ml-5">
        {t('safetyNote')}
      </p>
      {!tokenAllowanceLoading && tokenAllowance > 0 && (
        <div className='mt-3 xl:mt-0 xl:ml-3'>
          <button
            className="bg-moon-gold px-2 py-1 xl:w-[160px] text-white transition-all duration-150 hover:scale-105 font-semibold rounded-md"
            onClick={() => revokeAllowance()}
          >
            Revoke allowance
          </button>
        </div>
      )}
    </div>
  )
}
