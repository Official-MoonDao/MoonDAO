import useSWR, { Fetcher } from 'swr'

function jsonFetcher(): Fetcher<any, string> {
  return async (url) => {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }
    const json = await res.json()
    if (json.success === false) {
      throw new Error(json.error || 'An unknown error occurred')
    }
    return json
  }
}

export interface DiscordUser {
  id: string
  username: string
  global_name: string | null
  avatar: string
}

type DiscordUserSearchResponse = {
  user: DiscordUser
}[]

export default function useDiscordUserSearch(
  username: string,
  shouldFetch: boolean = false
) {
  const { data, error, isLoading } = useSWR<DiscordUserSearchResponse, Error>(
    shouldFetch ? `/api/discord/search?username=${username}` : null,
    jsonFetcher(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0
    }
  )

  return {
    data,
    isLoading,
    error: error?.message,
    isError: !!error
  }
}