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

export default function SweepstakesSelection({ supply, account }: any) {
  const [winners, setWinners]: any = useState([])

  const [loading, setLoading] = useState(false)
  const [event, setEvent]: any = useState()

  const { data: currWinner }: any = useCurrentWinner()

  const { data: selectionData, write: randomSelection } = useRandomSelection()
  useSweepstakesEvent(setEvent)

  const totalTokenIds =
    process.env.NEXT_PUBLIC_CHAIN === 'sepolia'
      ? vMooneySweepstakes_Sepolia_totalSupply
      : vMooneySweepstakes_Mainnet_totalSupply

  async function getWinners(loop = false) {
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_INFURA_URL
    )
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

  useEffect(() => {
    if (!winners[0]) {
      console.log(winners)
      ;(async () => {
        await getWinners()
      })()
    }
  }, [selectionData])

  useEffect(() => {
    ;(async () => {
      await getWinners()
    })()
  }, [event])

  function Winner({ winner, i }: any) {
    if ((winner && !winner.discordUsername) || !winner.discordId) {
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
      <div className="flex w-full gap-4 items-center">
        {winners[0] && (
          <button
            className="flex w-8"
            disabled={loading}
            onClick={async () => await getWinners()}
          >
            <RefreshIcon
              className={`w-8 h-8 z-[-10] ${
                loading && 'animate-spin opacity-[0.8]'
              }`}
            />
          </button>
        )}
        {account &&
          account?.address === process.env.NEXT_PUBLIC_SWEEPSTAKES_OWNER && (
            <button
              className="btn text-black hover:bg-n3blue"
              onClick={randomSelection}
            >
              Random Selection
            </button>
          )}
      </div>

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
          winners.map((winner: any, i: number) => (
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
