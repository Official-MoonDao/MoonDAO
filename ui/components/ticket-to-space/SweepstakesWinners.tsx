import Link from 'next/link'
import { useEffect, useState } from 'react'

type Winner = {
  tokenId: string
  address: string
}

const PRIZES = [
  "🚀 Ticket to Space on Blue Origin's New Shepard!",
  '💰 200,000 $MOONEY',
  '💰 100,000 $MOONEY',
  '💰 50,000 $MOONEY',
  '💰 50,000 $MOONEY',
  '💰 30,000 $MOONEY',
  '💰 30,000 $MOONEY',
  '💰 30,000 $MOONEY',
  '💰 30,000 $MOONEY',
  '💰 30,000 $MOONEY',
]

function Winner({ number, tokenId, address, prize }: any) {
  return (
    <div
      className={`flex items-center gap-4 px-5 lg:px-7 xl:px-10 py-6 border-2 dark:border-[#ffffff20] font-RobotoMono w-[300px] md:w-[400px] lg:mt-10 lg:w-3/4 lg:max-w-[1080px] text-slate-950 text-sm dark:text-white ${
        number === 1 && 'border-moon-gold dark:border-moon-gold'
      }`}
    >
      <h1
        className={`font-[Goodtimes] text-2xl ${
          number === 1 && 'text-moon-gold'
        }`}
      >
        {number}
      </h1>
      <div
        className={`w-[2px] h-12 bg-[#00000020] dark:bg-[#ffffff20] ${
          number === 1 && 'bg-moon-gold dark:bg-moon-gold'
        }`}
      />
      <div className="flex flex-col w-full">
        <p>{`Token Id : ${tokenId}`}</p>
        <Link
          href={'https://polygonscan.com/address/' + address}
          target="_blank"
        >
          {`Address : ${address?.slice(0, 6)}...${address?.slice(-4)}`}
        </Link>
      </div>
      <div
        className={`w-[2px] h-12 bg-[#00000020] dark:bg-[#ffffff20] ${
          number === 1 && 'bg-moon-gold dark:bg-moon-gold'
        }`}
      />
      <div className="flex w-1/2">
        <p>{prize}</p>
      </div>
    </div>
  )
}

export function SweepstakesWinners({ ttsContract, supply }: any) {
  const [winners, setWinners] = useState<Winner[]>([])

  async function getWinners() {
    const winners = []

    for (let i = 0; i <= 10; i++) {
      try {
        const randomWordsId = await ttsContract.call('requestIds', [i])
        if (randomWordsId) {
          const { randomWords } = await ttsContract.call('getRequestStatus', [
            randomWordsId,
          ])

          const winningTokenId = await randomWords[0].mod(supply)

          const ownerOfWinningTokenId = await ttsContract.call('ownerOf', [
            winningTokenId.toString(),
          ])

          const winner = {
            tokenId: winningTokenId,
            address: ownerOfWinningTokenId,
          }

          // winners.push(winner)
          winners.push(winner)
        }
      } catch (err) {
        console.log(err)
      }
    }
    setWinners(winners.reverse())
  }

  useEffect(() => {
    let refresh: any
    if (ttsContract && supply) {
      getWinners()
      refresh = setInterval(() => {
        getWinners()
      }, 5000)
    }
    return () => clearInterval(refresh)
  }, [ttsContract, supply])

  return (
    <>
      <div className="mt-5">
        <h2 className="page-title">Winners</h2>
        <div className="w-full flex flex-col items-start">
          <button
            className="w-[250px] md:w-1/2 mt-4 p-1 border text-white hover:scale-105 transition-all duration-150 border-white hover:bg-white hover:text-moon-orange"
            onClick={getWinners}
          >
            Refresh ↺
          </button>
        </div>
        {winners.length > 0 ? (
          <div className="flex flex-col items-start">
            {winners.map((winner: any, i: number) => (
              <Winner
                key={'Winner-' + i}
                number={10 - winners.length + i + 1}
                name={winner.name}
                tokenId={winner.tokenId}
                address={winner.address}
                prize={PRIZES[10 - winners.length + i]}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-start">
            <div className="flex gap-4 px-5 lg:px-7 xl:px-10 py-6 border-2 dark:border-[#ffffff20] font-RobotoMono w-[400px] h-[100px] lg:mt-10 lg:w-3/4 lg:max-w-[1080px] text-slate-950 text-sm dark:text-white animate-pulse"></div>
          </div>
        )}
      </div>
    </>
  )
}
