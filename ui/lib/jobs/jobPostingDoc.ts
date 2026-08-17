import { fetchFromIPFSWithFallback } from '@/lib/ipfs/gateway'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import { JobPostingDoc, normalizeJobPostingDoc } from './jobMetadata'

/**
 * Load the long-form posting stored on IPFS. Never throws: a job page must still
 * render from its on-chain fields when a gateway is slow or the CID is bad.
 */
export async function fetchJobPostingDoc(cid?: string): Promise<JobPostingDoc | null> {
  if (!cid) return null
  try {
    const raw = await fetchFromIPFSWithFallback(cid)
    return normalizeJobPostingDoc(raw)
  } catch (error) {
    console.error(`Failed to load job posting document ${cid}:`, error)
    return null
  }
}

/** Pin a posting document and return its CID. Client-side; requires a signed-in user. */
export async function pinJobPostingDoc(doc: JobPostingDoc, title: string): Promise<string> {
  const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' })
  const file = new File([blob], `job-${title.slice(0, 40).replace(/\s+/g, '-')}.json`, {
    type: 'application/json',
  })
  const { cid } = await pinBlobOrFile(file)
  return cid
}
