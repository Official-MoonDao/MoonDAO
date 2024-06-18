import { Controller, useFormContext } from 'react-hook-form'
import { formatNumberUSStyle } from '../../../lib/nance'
import {
  SafeBalanceUsdResponse,
  useSafeBalances,
} from '../../../lib/nance/SafeHooks'
import { formatUnits } from 'ethers/lib/utils'
import GenericListbox from '../GenericListbox'

type ListBoxItems = {
  id: string
  name?: string
}

const ETH_ADDRESS = '0x000000000000000000000000000000000000EEEe'

const safeBalanceToItems = (b: SafeBalanceUsdResponse[]): ListBoxItems[] => {
  return (
    b
      //.filter((b) => !!b.tokenAddress && !!b.token)
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
          id: (b.tokenAddress as string) || ETH_ADDRESS,
          name:
            (b.token?.symbol || 'ETH') +
            ` (${formatNumberUSStyle(
              formatUnits(b.balance, b.token?.decimals || 18),
              true
            )})`,
        }
      })
  )
}

export default function SafeTokenForm({
  address,
  fieldName,
}: {
  address: string
  fieldName: string
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext()

  const { data, isLoading, error } = useSafeBalances(address, !!address)
  const items: ListBoxItems[] = data
    ? safeBalanceToItems(data)
    : [{ id: 'nope', name: 'no tokens found in Safe' }]

  return (
    <Controller
      name={fieldName}
      control={control}
      defaultValue={items[0]?.id}
      render={({ field: { onChange, value } }) => (
        <GenericListbox<ListBoxItems>
          value={
            items.find((i) => i.id === value) ||
            items[0] || {
              id: undefined,
              name: 'no tokens found in Safe',
            }
          }
          onChange={(c) => onChange(c.id)}
          label="Token"
          items={items}
          disabled={items.length === 0}
        />
      )}
      shouldUnregister
    />
  )
}
