import { MOONEY_ADDRESSES } from 'const/config'
import { useEffect } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { formatNumberUSStyle } from '@/lib/nance'
import { SafeBalanceUsdResponse, useSafeBalances } from '@/lib/nance/SafeHooks'
import { formatUnits } from 'ethers/lib/utils'
import GenericListbox from '../GenericListbox'

type ListBoxItems = {
  id: string
  name?: string
}

export const ETH_MOCK_ADDRESS = 'ETH'

const safeBalanceToItems = (b: SafeBalanceUsdResponse[]): ListBoxItems[] => {
  return b
    .sort(
      (a, b) =>
        parseInt(
          formatNumberUSStyle(formatUnits(b.balance, b.token?.decimals || 18))
        ) -
        parseInt(
          formatNumberUSStyle(formatUnits(a.balance, a.token?.decimals || 18))
        )
    )
    .map((b) => {
      return {
        id: (b.tokenAddress as string) || ETH_MOCK_ADDRESS,
        name:
          (b.token?.symbol || 'ETH') +
          ` (${formatNumberUSStyle(
            formatUnits(b.balance, b.token?.decimals || 18),
            true
          )})`,
      }
    })
}

export default function SafeTokenForm({
  address,
  fieldName,
  acceptedTokens,
}: {
  address: string
  fieldName: string
  acceptedTokens?: string[]
}) {
  const {
    control,
    formState: { errors },
    setValue,
    getValues,
  } = useFormContext()

  const { data, isLoading, error } = useSafeBalances(address, !!address)
  const items: ListBoxItems[] = data
    ? safeBalanceToItems(data)
    : [{ id: 'nope', name: 'no tokens found in Safe' }]

  const filteredItems = acceptedTokens
    ? items.filter((item) => {
        console.log('item', item)
        console.log('acceptedTokens', acceptedTokens)
        return acceptedTokens.some((token) => item.name?.startsWith(token))
      })
    : items

  // set default to first item after data loads
  useEffect(() => {
    if (data && data.length > 0) {
      const currentValue = getValues(fieldName)
      if (currentValue === '')
        setValue(fieldName, data[0].tokenAddress || ETH_MOCK_ADDRESS)
    }
  }, [data, setValue, getValues, fieldName])

  return (
    <Controller
      name={fieldName}
      control={control}
      defaultValue={items[0]?.id}
      render={({ field: { onChange, value } }) => (
        <GenericListbox<ListBoxItems>
          value={
            filteredItems.find((i) => i.id === value) ||
            filteredItems[0] || {
              id: undefined,
              name: 'no tokens found in Safe',
            }
          }
          onChange={(c) => onChange(c.id)}
          label="Token"
          items={filteredItems}
          disabled={filteredItems.length === 0}
        />
      )}
      shouldUnregister
    />
  )
}
