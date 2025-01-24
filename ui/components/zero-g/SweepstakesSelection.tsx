import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { BigNumber, Contract, ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { useUserData } from '../../lib/zero-g/google-sheets'
import { ZERO_G_V1_TOTAL_TOKENS } from '../../lib/zero-g/zero-g-sweepstakes'
import useRead from '@/lib/thirdweb/hooks/useRead'
import vMooneySweepstakesZeroGABI from '../../const/abis/vMooneySweepstakes.json'
import { VMOONEY_SWEEPSTAKES } from '../../const/config'

//Issue w/ getting winners from contract in production, so hardcoding for now. Can read winners from contract in localhost.

export default function SweepstakesSelection({
  sweepstakesContract,
  supply,
  account,
}: any) {
  const [winners, setWinners]: any = useState([])

  const [loading, setLoading] = useState(false)
  const [event, setEvent]: any = useState()

  const { data: currWinner }: any = useRead({
    contract: sweepstakesContract,
    method: 'winner',
    params: [],
  })

  const {
    data: winnersData,
    isLoading: isLoadingWinners,
    getUserDataRaffle,
  } = useUserData()

  useEffect(() => {
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_INFURA_URL
    )

    async function getWinners(loop = false) {
      setLoading(true)
      const winnersData: any = []
      const contract: any = new Contract(
        VMOONEY_SWEEPSTAKES,
        vMooneySweepstakesZeroGABI,
        provider
      )
      for (let i = 0; i < 10; i++) {
        //get random word for id
        try {
          const randomWordsId = await readContract({
            contract: contract,
            method: 'requestIds' as string,
            params: [i],
          })
          if (randomWordsId) {
            const randomWords = await readContract({
              contract: contract,
              method: 'getRequestStatus' as string,
              params: [randomWordsId],
            })
            const winningTokenId = await BigNumber.from(randomWords[0])
              .mod(BigNumber.from(ZERO_G_V1_TOTAL_TOKENS))
              .toString()
            const winnerAddress = await readContract({
              contract: contract,
              method: 'ownerOf' as string,
              params: [winningTokenId],
            })

            const winnerData: any = getUserDataRaffle(winnerAddress as any)

            winnersData.push({
              discordUsername: winnerData?.DiscUsername,
              discordId: winnerData?.DiscID,
              address: winnerAddress,
              tokenId: winningTokenId,
              id: i,
            })
          }
        } catch (err) {
          console.log('No matching request id', err)
        }
      }
      await setWinners(winnersData.sort((a: any, b: any) => a.id - b.id))
      setLoading(false)
    }

    if (winnersData) {
      getWinners()
    }
  }, [winnersData, getUserDataRaffle])

  function Winner({ winner, i }: any) {
    if (winner && !winner.discordUsername) {
      return (
        <div
          id={`winner-${i}`}
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
              <strong>Discord Username:</strong>{' '}
              <p id="winner-discord-username">{winner.discordUsername}</p>
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
      <div
        id="sweepstakes-winners"
        className="flex flex-col gap-2 overflow-y-scroll h-[400px]"
      >
        {!loading && winners[0] ? (
          winners.map((winner: any, i: number) => (
            <Winner key={`winner-${i}`} winner={winner} i={i} />
          ))
        ) : (
          <div className="flex flex-col rounded-md p-4 bg-gradient-to-tr from-n3blue to-amber-200">
            <ArrowPathIcon className="animate-spin h-8 w-8" />
          </div>
        )}
      </div>
    </div>
  )
}
