import { useEffect, useState } from 'react'
import { Client, TypedDocumentNode, cacheExchange, fetchExchange } from 'urql'

export function useGQLQuery(
  apiUrl: string,
  query: TypedDocumentNode<any>,
  variables: any = {}
) {
  const gqlClient = new Client({
    url: apiUrl,
    exchanges: [fetchExchange, cacheExchange],
  })

  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<any>()
  const [error, setError] = useState<any>()

  async function runQuery() {
    setIsLoading(true)
    try {
      const result = await gqlClient.query(query, variables).toPromise()
      setData(result.data)
    } catch (err: any) {
      setError(err.message)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (gqlClient && query && !data) {
      runQuery()
    }
  }, [gqlClient, query, variables])

  return { data, isLoading, error, update: runQuery }
}
