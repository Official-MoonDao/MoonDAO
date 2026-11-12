import { ensureWalletOnChain } from '@/lib/contributions/walletChain'

const ADDRESS = '0x' + 'ab'.repeat(20)
const arbitrum = { id: 42161, name: 'Arbitrum One' } as any

function fakeWallet(startChain: number, switchesTo: number | null) {
  let chainId = startChain
  const calls: number[] = []
  const wallet = {
    address: ADDRESS.toUpperCase().replace('0X', '0x'),
    getEthereumProvider: async () => ({
      request: async () => '0x' + chainId.toString(16),
    }),
    switchChain: async (id: number) => {
      calls.push(id)
      if (switchesTo == null) throw Object.assign(new Error('User rejected'), { code: 4001 })
      chainId = switchesTo
    },
  }
  return { wallet: wallet as any, calls }
}

describe('contribution wallet chain', () => {
  it('leaves a wallet already on the chain alone', async () => {
    const { wallet, calls } = fakeWallet(42161, 42161)
    await ensureWalletOnChain([wallet], ADDRESS, arbitrum)
    expect(calls).to.deep.equal([])
  })

  it('switches a wallet left on Ethereum before signing', async () => {
    const { wallet, calls } = fakeWallet(1, 42161)
    await ensureWalletOnChain([wallet], ADDRESS, arbitrum)
    expect(calls).to.deep.equal([42161])
  })

  it('refuses to sign when the wallet stays on another network', async () => {
    const { wallet } = fakeWallet(1, null)
    let message = ''
    await ensureWalletOnChain([wallet], ADDRESS, arbitrum).catch((e) => (message = e.message))
    expect(message).to.equal('Switch your wallet to Arbitrum and try again.')
  })

  it('trusts the wallet over a switch that reports success', async () => {
    const { wallet } = fakeWallet(1, 1)
    let message = ''
    await ensureWalletOnChain([wallet], ADDRESS, arbitrum).catch((e) => (message = e.message))
    expect(message).to.match(/Switch your wallet to Arbitrum/)
  })

  it('skips wallets Privy does not manage', async () => {
    await ensureWalletOnChain([], ADDRESS, arbitrum)
  })
})
