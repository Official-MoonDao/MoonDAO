import { DEFAULT_CHAIN_V5 } from 'const/config'
import fs from 'fs'
import path from 'path'
import { arbitrum, sepolia } from '@/lib/rpc/chains'
import { resolveTablelandQueryChain } from '@/lib/tableland/resolveQueryChain'

const UI_ROOT = path.resolve(__dirname, '../../../../')

describe('tableland query chain', () => {
  it('uses the default chain when the slug is omitted or blank', () => {
    for (const slug of [undefined, null, '', '   ']) {
      const resolved = resolveTablelandQueryChain(slug)
      expect(resolved.ok).to.equal(true)
      if (resolved.ok) expect(resolved.chain).to.equal(DEFAULT_CHAIN_V5)
    }
  })

  it('resolves an explicit slug and rejects an unknown one', () => {
    const sep = resolveTablelandQueryChain('sepolia')
    const padded = resolveTablelandQueryChain(' sepolia ')
    const arb = resolveTablelandQueryChain('arbitrum')
    expect(sep.ok).to.equal(true)
    expect(padded.ok).to.equal(true)
    expect(arb.ok).to.equal(true)
    if (sep.ok) expect(sep.chain).to.equal(sepolia)
    if (padded.ok) expect(padded.chain).to.equal(sepolia)
    if (arb.ok) expect(arb.chain).to.equal(arbitrum)
    expect(resolveTablelandQueryChain('not-a-chain').ok).to.equal(false)
  })

  it('passes the prize chain through the citizen lookup and rejects an unknown chain on the route', () => {
    const owners = fs.readFileSync(
      path.join(UI_ROOT, 'lib/citizen/useCitizenRowsByOwners.ts'),
      'utf8'
    )
    const queryHook = fs.readFileSync(path.join(UI_ROOT, 'lib/swr/useTablelandQuery.ts'), 'utf8')
    const route = fs.readFileSync(path.join(UI_ROOT, 'pages/api/tableland/query.ts'), 'utf8')
    expect(owners).to.include('chainSlug')
    expect(queryHook).to.include('&chain=')
    expect(route).to.include('resolveTablelandQueryChain')
    expect(route).to.include('Unknown chain')
    expect(route).to.not.include('queryTable(DEFAULT_CHAIN_V5')
  })
})
