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
import { PhotoIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline"
import { classNames } from '../../../lib/utils/tailwind'
import { LoadingSpinner } from "../../layout/LoadingSpinner"

const noUser: DiscordUser = {
  id: '',
  username: '',
  global_name: '',
  avatar: ''
}

export default function DiscordUserIdInput({
  val,
  displayVal,
  setVal,
  inputStyle = '',
  disabled = false,
}: {
  val: DiscordUser | undefined
  displayVal: string
  setVal: (v: DiscordUser | undefined) => void
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
      setVal(noUser)
    }
  }, [disabled, val, setVal])

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
        setVal(u || noUser)
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
            selectedUser ? `@${selectedUser.global_name}` : displayVal ? `@${displayVal}` : query
          }
          placeholder="Search..."
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
          <ChevronDownIcon
            className="h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
        </ComboboxButton>

        <ComboboxOptions className="absolute inner-container-background z-10 mt-1 max-h-60 w-max overflow-y-auto overflow-x-visible rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
          {data
            ?.map((d) => d.user)
            .map((u) => (
              <ComboboxOption
                key={u.id}
                value={u}
                className={({ focus }) =>
                  classNames(
                    'relative cursor-default select-none py-2 pl-3 pr-9 whitespace-nowrap',
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

          {loading && (
            <div className="py-2 pl-3 pr-9 min-w-60 text-gray-500">
              <div className="flex items-center">
                <LoadingSpinner />
              </div>
            </div>
          )}

          {data?.length === 0 && !loading && (
            <div className="py-2 pl-3 pr-9 whitespace-nowrap text-gray-500">
              <div className="flex items-center">
                <QuestionMarkCircleIcon className="w-6 h-6 text-gray-400" />
                <div className="ml-2">
                  <p className="text-sm">No results found</p>
                  <p className="text-xs text-gray-400">Type a different username</p>
                </div>
              </div>
            </div>
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  )
}

function DiscordUserInfoEntry({ user }: { user: DiscordUser }) {
  console.log(user)
  return (
    <div className="flex">
      {user.avatar ? (
        <img
          src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
          alt=""
          className="h-6 w-6 flex-shrink-0 rounded-full"
        />
      ) : (
        <PhotoIcon className="w-6 h-6" />
      )}

      <div className="flex flex-col ml-2">
        <span className="truncate">{user.username}</span>

        <p className="truncate text-gray-400">{`@${user.global_name}`}</p>
      </div>
    </div>
  )
}
