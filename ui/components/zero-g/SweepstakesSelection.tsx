import { RefreshIcon } from '@heroicons/react/outline'
import { BigNumber, Contract, ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { vMooneySweepstakesZeroG } from '../../lib/config'
import { getUserDataRaffle } from '../../lib/google-sheets'
import {
  useCurrentWinner,
  useRandomSelection,
  useSweepstakesEvent,
} from '../../lib/zero-g-sweepstakes'
import vMooneySweepstakesABI from '../../abis/vMooneySweepstakes.json'

const requestIds = 10

const vMooneySweepstakes_Sepolia_totalSupply = 5
const vMooneySweepstakes_Mainnet_totalSupply = 19 //# of holders at time of sweepstakes deadline

const WINNERS = [
  {
    discordUsername: 'Foggy',
    tokenId: 9,
    address: '0xbaA30D271Baa23E5f4CCA6547F3B248e8DCd8868',
  },
  {
    discordUsername: 'Mitchie',
    tokenId: 15,
    address: '0x9fDf876a50EA8f95017dCFC7709356887025B5BB',
  },
  {
    discordUsername: 'phil',
    tokenId: 3,
    address: '0x6bFd9e435cF6194c967094959626ddFF4473a836',
  },
  {
    discordUsername: 'pipilu',
    tokenId: 8,
    address: '0x4c55C41Bd839B3552fb2AbecaCFdF4a5D2879Cb9',
  },
  {
    discordUsername: '先锋队robin',
    tokenId: 17,
    address: '0x11B0105330a85F01bb6567C0a6448740f07D7BFD',
  },
  {
    discordUsername: 'ThetaV',
    tokenId: 16,
    address: '0x625c6A3DD00dc44dF53e4ee1C8263574c1E21a3a',
  },
  {
    discordUsername: '先锋队robin',
    tokenId: 17,
    address: '0x11B0105330a85F01bb6567C0a6448740f07D7BFD',
  },
  { tokenId: 12, address: '0x5b2907B3dC0f7ec146168760e298901C7015e7f6' },
  {
    discordUsername: 'ryand2d',
    tokenId: 18,
    address: '0x78176eAAbCB3255E898079dC67428e15149cdc99',
  },
  {
    discordUsername: 'justinpark01',
    tokenId: 14,
    address: '0x9A1741b58Bd99EBbc4e9742Bd081b887DfC95f53',
  },
]

export default function SweepstakesSelection({ supply, account }: any) {
  const [winners, setWinners]: any = useState([])

  const [loading, setLoading] = useState(false)
  const [event, setEvent]: any = useState()

  const { data: currWinner }: any = useCurrentWinner()

  const { data: selectionData, write: randomSelection } = useRandomSelection()
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.NEXT_PUBLIC_INFURA_URL
  )
  useSweepstakesEvent(setEvent)

  const totalTokenIds =
    process.env.NEXT_PUBLIC_CHAIN === 'sepolia'
      ? vMooneySweepstakes_Sepolia_totalSupply
      : vMooneySweepstakes_Mainnet_totalSupply

  async function getWinners(loop = false) {
    setLoading(true)
    const contract = new Contract(
      vMooneySweepstakesZeroG,
      vMooneySweepstakesABI,
      provider
    )
    const winnersData: any = []
    for (let i = 0; i < requestIds; i++) {
      //get random word for id
      try {
        const res = await contract.callStatic.requestIds(i)
        if (!res) break

        if (res) {
          const { randomWords } = await contract.callStatic.getRequestStatus(
            res
          )

          const winningTokenId = await randomWords[0]
            .mod(BigNumber.from(totalTokenIds))
            .toString()
          const winnerAddress = await contract.callStatic.ownerOf(
            winningTokenId
          )
          const winnerData = await getUserDataRaffle(winnerAddress)
          if (winnerData === 'rate limit' && !loop) {
            setWinners([])
            return setTimeout(async () => {
              await getWinners(true)
            }, 5000)
          }
          console.log(winnerData)

          winnersData.push({
            discordUsername: winnerData?.DiscUsername,
            discordId: winnerData?.DiscID,
            address: winnerAddress,
            tokenId: winningTokenId,
            id: i,
          })
        }
      } catch (err) {
        // console.log('No matching request id', err)
      }
      await setWinners([...winnersData.sort((a: any, b: any) => a.id - b.id)])
      setTimeout(() => {
        setLoading(false)
      }, 1000)
    }
  }

  // useEffect(() => {
  //   if (!winners[0]) {
  //     ;(async () => {
  //       await getWinners()
  //     })()
  //   }
  // }, [selectionData])

  // useEffect(() => {
  //   ;(async () => {
  //     await getWinners()
  //   })()
  // }, [event])

  function Winner({ winner, i }: any) {
    if (winner && !winner.discordUsername) {
      return (
        <div
          className={`flex flex-col rounded-md p-4 bg-gradient-to-tr from-n3green to-red-500 text-black divide-y-2 divide-black`}
        >
          {!loading ? (
            <>
              <h1 className="text-[125%]">{`Winner #${10 - i}`}</h1>
              <div className="flex">
                <strong>Discord Username:</strong> <p>{'none'}</p>
              </div>
              <div className="flex">
                <strong>Token ID:</strong>

                <p>{winner.tokenId}</p>
              </div>
              <div className="flex">
                <strong>Address:</strong>

                <button
                  onClick={() =>
                    window.open(
                      `https://etherscan.io/address/${winner?.address}`
                    )
                  }
                >
                  {winner.address.slice(0, 6) +
                    '...' +
                    winner.address.slice(-4)}
                </button>
              </div>
            </>
          ) : (
            <div>loading</div>
          )}
        </div>
      )
    }
    return (
      <div
        className={`flex flex-col rounded-md p-4 bg-gradient-to-tr from-n3blue to-amber-200 text-black divide-y-2 divide-black ${
          i === winners.length - 1 && 'to-amber-500'
        }`}
      >
        {!loading ? (
          <>
            <h1 className="text-[125%]">{`Winner #${10 - i}`}</h1>
            <div className="flex">
              <strong>Discord Username:</strong> <p>{winner.discordUsername}</p>
            </div>
            <div className="flex">
              <strong>Token ID:</strong>

              <p>{winner.tokenId}</p>
            </div>
            <div className="flex">
              <strong>Address:</strong>

              <button
                onClick={() =>
                  window.open(`https://etherscan.io/address/${winner?.address}`)
                }
              >
                {winner.address.slice(0, 6) + '...' + winner.address.slice(-4)}
              </button>
            </div>
          </>
        ) : (
          <div>loading</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full my-4 p-4 rounded-md">
      <h1 className="text-[125%]">Winners:</h1>
      {currWinner && (
        <div>
          <div className="flex gap-2">
            <strong className="">{`Current Winner : `}</strong>

            <button
              className="text-n3blue"
              onClick={() =>
                window.open(`https://etherscan.io/address/${currWinner}`)
              }
            >{`${currWinner.slice(0, 6)}...${currWinner.slice(-4)}`}</button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2 overflow-y-scroll h-[400px]">
        {!loading ? (
          WINNERS.map((winner: any, i: number) => (
            <Winner key={`winner-${i}`} winner={winner} i={i} />
          ))
        ) : (
          <div className="flex flex-col rounded-md p-4 bg-gradient-to-tr from-n3blue to-amber-200">
            <RefreshIcon className="animate-spin h-8 w-8" />
          </div>
        )}
      </div>
    </div>
  )
}
