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

  function runQuery(vars: any = variables) {
    setIsLoading(true)
    gqlClient
      .query(query, vars)
      .toPromise()
      .then((result) => {
        setData(result.data)
      })
      .catch((err: any) => {
        setError(err.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    if (variables && !isLoading) runQuery()
    runQuery()
  }, [variables.skip])

  return { data, isLoading, error, update: runQuery }
}
