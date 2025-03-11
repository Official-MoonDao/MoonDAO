import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon } from '@heroicons/react/20/solid'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { Fragment } from 'react'
import { classNames } from '@/lib/utils/tailwind'

type Option<T> = {
  label: string
  value: T
}

type SelectorProps<T> = {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  className?: string
  buttonClassName?: string
  placeholder?: string
}

export default function Selector<T>({
  value,
  onChange,
  options,
  className = 'relative w-[8rem] text-xs uppercase',
  buttonClassName = 'relative w-full cursor-default rounded-md bg-white py-1 px-2 text-left shadow-sm border border-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs uppercase',
  placeholder = 'Select option',
}: SelectorProps<T>) {
  const selectedOption = options.find((o) => o.value === value)

  return (
    <Listbox
      value={selectedOption}
      onChange={(option) => onChange(option.value)}
    >
      {({ open }) => (
        <div className={className}>
          <Listbox.Button className={buttonClassName}>
            <span className="block truncate text-black">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-4 w-4 text-gray-400"
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>

          <Transition
            show={open}
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {options.map((option, optionIdx) => (
                <Listbox.Option
                  key={optionIdx}
                  className={({ active }) =>
                    classNames(
                      active ? 'bg-indigo-600 text-white' : 'text-gray-900',
                      'relative cursor-default select-none py-2 pl-3 pr-9'
                    )
                  }
                  value={option}
                >
                  {({ selected, active }) => (
                    <>
                      <span
                        className={classNames(
                          selected ? 'font-semibold' : 'font-normal'
                        )}
                      >
                        {option.label}
                      </span>

                      {selected ? (
                        <span
                          className={classNames(
                            active ? 'text-white' : 'text-indigo-600',
                            'absolute inset-y-0 right-0 flex items-center pr-4'
                          )}
                        >
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  )
}
