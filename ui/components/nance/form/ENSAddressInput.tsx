import { Combobox } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'
import { useENS } from '../../../lib/utils/hooks/useENS'
import { classNames } from '../../../lib/utils/tailwind'

/**
 * A component that allows users to enter an address or ENS name. If the user enters an ENS name, it will resolve to an address.
 */
export default function ENSAddressInput({
  val,
  setVal,
  inputStyle = '',
  disabled = false,
  disabledTooltip,
}: {
  val: string
  setVal: (v: any) => void
  inputStyle?: string
  defaultValue?: string
  disabled?: boolean
  disabledTooltip?: string
}) {
  const [query, setQuery] = useState('')
  const { data, isLoading } = useENS(query, query.endsWith('.eth'))
  const address = data?.address

  const filteredOption = query.endsWith('.eth') && address ? [address] : []

  const renderComboboxInput = () => {
    return (
      <Combobox.Input
        className={classNames(
          'w-full input dark:bg-black',
          isLoading && 'animate-pulse',
          inputStyle,
          disabled && 'cursor-not-allowed bg-gray-100'
        )}
        onChange={(event) => {
          setQuery(event.target.value)
          if (!query.endsWith('.eth')) {
            setVal(event.target.value)
          }
        }}
        displayValue={(option: string) => option}
        placeholder="Address/ENS"
      />
    )
  }

  return (
    <Combobox
      as="div"
      value={val}
      onChange={setVal}
      className="w-full"
      disabled={disabled}
    >
      <div className="relative">
        {disabled && disabledTooltip ? (
          <div className="tooltip" data-tip="hello">
            {renderComboboxInput()}
          </div>
        ) : (
          renderComboboxInput()
        )}

        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
          <ChevronDownIcon
            className="h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
        </Combobox.Button>

        {filteredOption.length > 0 && (
          <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {filteredOption.map((option) => (
              <Combobox.Option
                key={option}
                value={option}
                className={({ active }) =>
                  classNames(
                    'relative cursor-default select-none py-2 pl-3 pr-9',
                    active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                  )
                }
              >
                {({ active, selected }) => (
                  <>
                    <div className="flex items-center">
                      <span
                        className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-green-400"
                        aria-hidden="true"
                      />
                      <span
                        className={classNames(
                          'ml-3 truncate',
                          selected && 'font-semibold'
                        )}
                      >
                        {option}
                      </span>
                    </div>

                    {selected && (
                      <span
                        className={classNames(
                          'absolute inset-y-0 right-0 flex items-center pr-4',
                          active ? 'text-white' : 'text-indigo-600'
                        )}
                      >
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </Combobox.Option>
            ))}
          </Combobox.Options>
        )}
      </div>
    </Combobox>
  )
}
