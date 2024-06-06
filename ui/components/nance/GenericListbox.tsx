import {
  Listbox,
  Transition,
  ListboxOptions,
  ListboxOption,
  ListboxButton,
  Label,
} from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import Image from 'next/image'
import { Fragment } from 'react'
import { classNames } from '../../lib/utils/tailwind'

interface Includes {
  name?: string
  id?: string
  icon?: string
}
interface GenericListboxProps<T> {
  /**
   * The selected value of the listbox
   */
  value: T
  /**
   * The available items to display in the listbox
   */
  items: T[]
  /**
   * The function to call when the value of the listbox changes
   */
  onChange: (value: T) => void
  /**
   * Whether the listbox is disabled
   */
  disabled?: boolean
  /**
   * The label of the listbox
   */
  label: string
}

/**
 * GenericListbox which supports icons
 */
export default function GenericListbox<T extends Includes>({
  value,
  items,
  onChange,
  disabled,
  label,
}: GenericListboxProps<T>) {
  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      {({ open }) => (
        <>
          <Label className="block text-sm font-medium leading-6 text-gray-900">
            {label}
          </Label>
          <div className="relative">
            <ListboxButton className="relative w-full cursor-default rounded-md bg-white dark:bg-black py-2 pl-3 pr-10 text-left text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 sm:text-sm sm:leading-6">
              <span className="flex items-center dark:text-white">
                {value?.icon?.includes('https://') && (
                  <Image
                    src={value.icon}
                    alt=""
                    className="h-10 w-10 flex-shrink-0 rounded-full"
                    width={100}
                    height={100}
                  />
                )}
                <span className="ml-3 block truncate">{value?.name}</span>
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-2">
                <ChevronUpDownIcon
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </span>
            </ListboxButton>

            <Transition
              show={open}
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <ListboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-black py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {items &&
                  items.length > 0 &&
                  items.map((item) => (
                    <ListboxOption
                      key={item.id}
                      className={({ active }) =>
                        classNames(
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-900 dark:text-gray-500',
                          'relative cursor-default select-none py-2 pl-3 pr-9'
                        )
                      }
                      value={item}
                    >
                      {({ selected, active }) => (
                        <>
                          <div className="flex items-center">
                            {item?.icon?.includes('https://') && (
                              <Image
                                src={item.icon}
                                alt=""
                                className="h-10 w-10 flex-shrink-0 rounded-full"
                                width={100}
                                height={100}
                              />
                            )}
                            <span
                              className={classNames(
                                selected ? 'font-semibold' : 'font-normal',
                                'ml-3 block truncate'
                              )}
                            >
                              {item.name}
                            </span>
                          </div>

                          {selected ? (
                            <span
                              className={classNames(
                                active ? 'text-#2ecc71' : 'text-indigo-600',
                                'absolute inset-y-0 right-0 flex items-center pr-4'
                              )}
                            >
                              <CheckIcon
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            </span>
                          ) : null}
                        </>
                      )}
                    </ListboxOption>
                  ))}
              </ListboxOptions>
            </Transition>
          </div>
        </>
      )}
    </Listbox>
  )
}
