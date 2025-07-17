import request, { gql } from 'graphql-request'
import { useEffect, useState } from 'react'
import { useMemo } from 'react'

import useSWR from 'swr'

export function useTotalVP(address: string) {
  const [walletVP, setWalletVP] = useState<any>()

  useEffect(() => {
    async function getTotalVP() {
      const query = gql`
        {
          vp (voter: "${address}", space: "tomoondao.eth") {
            vp
          }
        }`
      const { vp } = (await request(
        `https://hub.snapshot.org/graphql`,
        query
      )) as any
      setWalletVP(vp.vp)
    }
    if (address && address !== '') getTotalVP()
  }, [address])

  return walletVP
}

// Simple in-memory cache shared across hook invocations
const vpCache: Record<string, number> = {}
// Retry configuration
const MAX_RETRIES = 3
const BASE_DELAY_MS = 200 // initial backoff delay

// Helper to delay execution
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useTotalVPs(addresses: string[]) {
  const [walletVPs, setWalletVPs] = useState<number[]>([])

  useEffect(() => {
    // AbortController to signal cancellation
    const controller = new AbortController()

    async function getTotalVPs() {
      // Determine which addresses we still need to fetch
      const addressesToFetch = addresses.filter((addr) => !(addr in vpCache))

      if (addressesToFetch.length > 0) {
        await Promise.all(
          addressesToFetch.map(async (address) => {
            let attempts = 0
            while (attempts < MAX_RETRIES) {
              try {
                const query = gql`
                  {
                    vp(voter: "${address}", space: "tomoondao.eth") {
                      vp
                    }
                  }
                `
                const { vp } = (await request(
                  'https://hub.snapshot.org/graphql',
                  query
                )) as any
                // Store result in cache
                vpCache[address] = vp.vp
                console.log(`Fetched and cached VP for: ${address} = ${vp.vp}`)
                return
              } catch (err: any) {
                attempts++
                // Handle aborts separately
                if (
                  err.name === 'AbortError' ||
                  err.message?.includes('Aborted')
                ) {
                  console.warn(`Fetch aborted for ${address}`)
                  break
                }
                console.warn(`Attempt ${attempts} failed for ${address}:`, err)
                if (attempts < MAX_RETRIES) {
                  const backoff = BASE_DELAY_MS * 2 ** (attempts - 1)
                  console.log(`Retrying ${address} in ${backoff}ms`)
                  await delay(backoff)
                  continue
                }
                console.error(
                  `All ${MAX_RETRIES} attempts failed for ${address}`
                )
                vpCache[address] = 0
              }
            }
          })
        )
      }

      // Map all addresses to either cached VP or fallback 0
      const results = addresses.map((addr) => vpCache[addr] ?? 0)
      console.log('Total VPs results:', results)
      setWalletVPs(results)
    }

    if (addresses.length > 0) {
      getTotalVPs().catch((err: any) => {
        if (err.name === 'AbortError' || err.message?.includes('Aborted')) {
          console.warn('Unexpected abort in getTotalVPs')
        } else {
          console.error('Unexpected error in getTotalVPs:', err)
        }
      })
    } else {
      setWalletVPs([])
    }

    return () => {
      controller.abort()
    }
  }, [addresses])

  return walletVPs
}
