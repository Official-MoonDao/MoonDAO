export type ForecastGasReply = { ok: boolean; status: number; body: any }

export type ForecastGasRequest = { wallet: string; chainId: number; deprizeId: number }

export const FORECAST_GAS_SESSION_EXPIRED =
  'Your session expired. Sign in to predict, or reload the page and try again.'

/** Asks the server to cover gas for one forecast. Never throws. */
export async function postForecastGas(
  request: ForecastGasRequest,
  accessToken: string | null,
  fetcher: typeof fetch = fetch
): Promise<ForecastGasReply> {
  try {
    const res = await fetcher('/api/deprize/sponsor-forecast-gas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(request),
    })
    const body = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, body }
  } catch (err) {
    console.warn('[forecast] gas request failed', err)
    return { ok: false, status: 0, body: {} }
  }
}

/**
 * A guest has no site session behind its Privy token, so a 401 means the
 * Privy session saved in this browser is dead. Try a fresh token first, then
 * a fresh guest. A signed-in account only gets the fresh token: starting a
 * guest would sign it out.
 */
export async function requestForecastGas<W extends { address: string }>(input: {
  writer: W
  chainId: number
  deprizeId: number
  canRenewGuest: boolean
  getToken: () => Promise<string | null>
  renewGuest: () => Promise<W | null>
  post?: (request: ForecastGasRequest, token: string | null) => Promise<ForecastGasReply>
}): Promise<{ reply: ForecastGasReply; writer: W }> {
  const post = input.post ?? ((request, token) => postForecastGas(request, token))
  const send = async (writer: W) =>
    post(
      { wallet: writer.address, chainId: input.chainId, deprizeId: input.deprizeId },
      await input.getToken().catch(() => null)
    )

  let writer = input.writer
  let reply = await send(writer)
  if (reply.status !== 401) return { reply, writer }

  reply = await send(writer)
  if (reply.status !== 401 || !input.canRenewGuest) return { reply, writer }

  const renewed = await input.renewGuest().catch(() => null)
  if (!renewed) return { reply, writer }
  writer = renewed
  reply = await send(writer)
  return { reply, writer }
}

export function forecastGasErrorMessage(reply: ForecastGasReply): string {
  if (typeof reply.body?.message === 'string') return reply.body.message
  if (reply.status === 401) return FORECAST_GAS_SESSION_EXPIRED
  return 'Could not cover gas for this prediction. Try again.'
}
