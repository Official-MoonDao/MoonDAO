import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core'
import {
  AlphaRouter,
  SwapOptionsSwapRouter02,
  SwapType,
} from '@uniswap/smart-order-router'
import { FeeAmount } from '@uniswap/v3-sdk'
import { ethers, BigNumber, Contract } from 'ethers'
import JSBI from 'jsbi'
import ERC20 from '../../const/abis/ERC20.json'
import V3_SWAP_ROUTER_ABI from '../../const/abis/UniswapPoolV3.json'
import { TOKENS } from './uniswap-config'

const zeroAddress = '0x0000000000000000000000000000000000000000'

const { abi: ERC20ABI } = ERC20
const V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'

const L1_MOONEY_ADDRESS = '0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395'

const chainId = 1 //mainnet
const MOONEY = new Token(chainId, L1_MOONEY_ADDRESS, 18, 'MOONEY', 'MOONEY')

const WETH = new Token(chainId, TOKENS[1].address, 18, 'WETH', 'Wrapped Ether')

const provider = new ethers.providers.JsonRpcProvider(process.env.FORK_URL)

function swapFromETH(
  route: any,
  web3provider: any,
  walletAddress: any,
  inputAmt: any,
  deadline: any
) {
  const router = new ethers.Contract(
    '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    V3_SWAP_ROUTER_ABI,
    web3provider
  )

  const etherAmt = ethers.utils.parseEther(inputAmt)
  console.log(ethers.utils.parseUnits(route?.quote.toFixed(6), 18))
  const params = {
    tokenIn: TOKENS[1].address,
    tokenOut: L1_MOONEY_ADDRESS,
    recipient: walletAddress,
    deadline: deadline,
    fee: FeeAmount.MEDIUM,
    amountIn: etherAmt,
    amountOutMinimum: ethers.utils.parseUnits(route?.quote.toFixed(6), 18),
    sqrtPriceLimitX96: 0,
  }
  // get gas price
  let data: any
  try {
    data = router.interface.encodeFunctionData('exactInputSingle', [params])
    console.log(data)
  } catch (err) {
    console.log(err)
  }
  const transaction = {
    chainId: chainId,
    to: V3_SWAP_ROUTER_ADDRESS,
    from: walletAddress,
    data: data,
    value: etherAmt,
    gasPrice: BigNumber.from(route?.gasPriceWei),
    gasLimit: ethers.utils.hexlify(199270),
  }
  return transaction
}

export async function getPrice(
  web3Provider: any,
  inputAmt: any,
  slippageAmt: number,
  deadline: any,
  walletAddress: string,
  tokenId: number // 0 = MOONEY, 1 = ETH, 2 = WETH, 3 = USDC, 4 = USDT, 5 = DAI
) {
  const inputToken = new Token(
    chainId,
    TOKENS[tokenId].address,
    TOKENS[tokenId].decimals,
    TOKENS[tokenId].symbol,
    TOKENS[tokenId].name
  )

  //Slippage
  const percentSlippage = new Percent(slippageAmt, 100)

  //Input Amount
  const wei = ethers.utils.parseUnits(
    inputAmt.toString(),
    TOKENS[tokenId].decimals
  )

  const currencyAmt = CurrencyAmount.fromRawAmount(inputToken, JSBI.BigInt(wei))

  const swapOptions: SwapOptionsSwapRouter02 = {
    recipient: walletAddress || zeroAddress,
    slippageTolerance: percentSlippage,
    deadline: deadline,
    type: SwapType.SWAP_ROUTER_02,
  }

  const router = new AlphaRouter({
    chainId: chainId,
    provider: provider,
  })

  const route = await router.route(
    currencyAmt,
    MOONEY,
    TradeType.EXACT_INPUT,
    swapOptions
  )

  let transaction
  if (tokenId === 1) {
    transaction = swapFromETH(
      route,
      web3Provider,
      walletAddress,
      inputAmt,
      deadline
    )
  } else if (walletAddress) {
    transaction = {
      data: route?.methodParameters?.calldata,
      to: V3_SWAP_ROUTER_ADDRESS,
      value:
        tokenId === 1
          ? ethers.utils.parseEther(inputAmt)
          : route?.methodParameters?.value,
      from: walletAddress || zeroAddress,
      gasPrice: BigNumber.from(route?.gasPriceWei),
      gasLimit: ethers.utils.hexlify(1000000),
    }
  } else transaction = {}

  const quoteAmtOut: any = route?.quote.toFixed(6)
  const ratio = (inputAmt / quoteAmtOut).toFixed(3)

  return [transaction, quoteAmtOut, ratio]
}

export async function swapForMooney(
  inputAmt: any,
  transaction: any,
  signer: any,
  tokenId: number,
  deadline: any
) {
  if (inputAmt <= 0) return

  const approvalAmt = ethers.utils
    .parseUnits(inputAmt?.toString(), TOKENS[tokenId].decimals)
    .toString()
  const inputTokenContract = new Contract(
    TOKENS[tokenId].address,
    ERC20ABI,
    provider
  )
  try {
    if (tokenId !== 1) {
      const balance = (
        await inputTokenContract.callStatic.balanceOf(signer._address)
      ).toString()

      if (balance <= 0) return console.log('Insufficient balance')
      console.log(balance)

      const allowance = (
        await inputTokenContract.callStatic.allowance(
          signer._address,
          V3_SWAP_ROUTER_ADDRESS
        )
      ).toString()

      if (allowance < approvalAmt) {
        await inputTokenContract
          .connect(signer)
          .approve(V3_SWAP_ROUTER_ADDRESS, approvalAmt)
      }
    } else {
    }
    const swap = await signer.sendTransaction(transaction)
    const receipt = await swap.wait()
    console.log(receipt)
  } catch (err) {
    console.log('Error when swapping', err)
  }
}
