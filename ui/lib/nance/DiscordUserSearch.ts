import useSWR, { Fetcher } from 'swr'

function jsonFetcher(): Fetcher<any, string> {
  return async (url) => {
    const res = await fetch(url)
    const json = await res.json()
    if (json?.success === 'false') {
      throw new Error(
        `An error occurred while fetching the data: ${json?.error}`
      )
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
  return useSWR<DiscordUserSearchResponse, string>(
    shouldFetch ? `/api/discord/search?username=${username}` : null,
    jsonFetcher()
  )
}
