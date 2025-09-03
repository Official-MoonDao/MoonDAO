import { arbitrum, base, ethereum, polygon } from '@/lib/infura/infuraChains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { MOONEY_ADDRESSES, POSITION_MANAGERS, PERMIT2_ADDRESS } from '@/const/config'
import useSafe from '@/lib/safe/useSafe'

const chain = base
const chainSlug = getChainSlug(base)
const SAFE_ADDRESS = '0xFca7C9f7753C9EF46213a3159eEf1F2b0a1e4a78'
const { safe, queueSafeTx, lastSafeTxExecuted } = useSafe(SAFE_ADDRESS, chain)
const iface = new ethers.utils.Interface(PERMIT2)
const maxUint160: bigint = (2n ** 160n) - 1n;
const timestampSeconds: number = Math.floor(Date.now() / 1000);
const ONE_HOUR = 60 * 60

const txData = iface.encodeFunctionData('approve', [
    MOONEY_ADDRESSES[chainSlug],
    POSITION_MANAGERS[chainSlug],
    maxUint160,
    timestampSeconds + ONE_HOUR
])
await queueSafeTx(
    to: PERMIT2_ADDRESS,
    data: txData,
    value: '0',
    safeTxGas: '1000000'
)

