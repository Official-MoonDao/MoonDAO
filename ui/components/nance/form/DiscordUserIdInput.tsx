import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/solid'
import { useEffect, useState } from 'react'
import { useDebounce } from 'react-use'
import useDiscordUserSearch, {
  DiscordUser,
} from '../../../lib/nance/DiscordUserSearch'
import { classNames } from '../../../lib/utils/tailwind'

export interface ProjectOption {
  id: string
  version: string
  handle: string
  projectId: number
  metadataUri: string
}

export default function DiscordUserIdInput({
  val,
  setVal,
  inputStyle = '',
  disabled = false,
}: {
  val: string | undefined
  setVal: (v: string | undefined) => void
  inputStyle?: string
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [username, setUsername] = useState('')
  const [selectedUser, setSelectedUser] = useState<DiscordUser | null>(null)

  const { data, isLoading: loading } = useDiscordUserSearch(
    username,
    !!username
  )

  useEffect(() => {
    if (disabled) {
      setVal('')
    }
  }, [disabled, setVal])

  useDebounce(
    () => {
      setUsername(query)
    },
    300,
    [query]
  )

  return (
    <Combobox
      disabled={disabled}
      as="div"
      value={selectedUser}
      onChange={(u: DiscordUser | null) => {
        setVal(u?.id || '')
        setSelectedUser(u)
      }}
      className="w-full"
    >
      <div className="relative">
        <ComboboxInput
          className={classNames(
            'w-full input dark:bg-black',
            loading && 'animate-pulse',
            inputStyle,
            disabled && 'bg-gray-100'
          )}
          onChange={(event) => setQuery(event.target.value)}
          displayValue={(selectedUser: DiscordUser | undefined) =>
            selectedUser ? `@${selectedUser.global_name}` : ''
          }
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
          <ChevronDownIcon
            className="h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
        </ComboboxButton>

        <ComboboxOptions className="absolute inner-container-background z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
          {data
            ?.map((d) => d.user)
            .map((u) => (
              <ComboboxOption
                key={u.id}
                value={u}
                className={({ focus }) =>
                  classNames(
                    'relative cursor-default select-none py-2 pl-3 pr-9',
                    focus
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-900 dark:text-gray-400'
                  )
                }
              >
                {({ focus, selected }) => (
                  <>
                    <DiscordUserInfoEntry user={u} />

                    {selected && (
                      <span
                        className={classNames(
                          'absolute inset-y-0 right-0 flex items-center pr-4',
                          focus ? 'text-white' : 'text-indigo-600'
                        )}
                      >
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </ComboboxOption>
            ))}
        </ComboboxOptions>
      </div>
    </Combobox>
  )
}

function DiscordUserInfoEntry({ user }: { user: DiscordUser }) {
  return (
    <div className="flex">
      <img
        src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
        alt=""
        className="h-6 w-6 flex-shrink-0 rounded-full"
      />

      <div className="flex flex-col ml-2">
        <span className="truncate">{user.username}</span>

        <p className="truncate text-gray-400">{`@${user.global_name}`}</p>
      </div>
    </div>
  )
}
