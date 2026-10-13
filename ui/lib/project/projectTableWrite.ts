import { getAccessToken } from '@privy-io/react-auth'

type ProjectTableWrite = {
  table: 'jobs' | 'marketplace'
  action: 'insert' | 'update' | 'delete'
  projectId: number | string
  rowId?: number | string
  /** Values already escaped with `cleanData`. */
  fields?: Record<string, string | number>
}

/** Writes a project's job or listing through the operator relay. */
export async function writeProjectTable(
  write: ProjectTableWrite
): Promise<{ rowId?: string; transactionHash: string }> {
  const accessToken = await getAccessToken()
  const res = await fetch('/api/project/table-write', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(write),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error || 'Could not save. Please try again.')
  return body
}
