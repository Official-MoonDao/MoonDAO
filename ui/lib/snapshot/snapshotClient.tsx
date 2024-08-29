import { cacheExchange, createClient, fetchExchange } from 'urql'

export const snapshotClient: any = createClient({
  url: 'https://hub.snapshot.org/graphql',
  exchanges: [fetchExchange, cacheExchange],
})
