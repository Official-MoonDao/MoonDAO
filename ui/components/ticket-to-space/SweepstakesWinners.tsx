import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useHandleRead, useHandleWrite } from '../../lib/thirdweb/hooks'

export function SweepstakesWinners({ sweepstakesContract }: any) {
  const [winners, setWinners] = useState<string[]>([])

  const { data: winnersCount } = useHandleRead(
    sweepstakesContract,
    'winnersCount'
  )

  const { mutateAsync: chooseWinner, isLoading: loadingWinner } =
    useHandleWrite(sweepstakesContract, 'chooseWinner')

  async function getWinners() {
    const winners = []
    for (let i = 10; i > 0; i--) {
      const winner = await sweepstakesContract.call('winners', [i])
      if (winner !== '0x0000000000000000000000000000000000000000') {
        winners.push(winner)
      }
    }
    setWinners(winners)
  }

  useEffect(() => {
    if (sweepstakesContract) getWinners()
  }, [winnersCount, loadingWinner, sweepstakesContract])

  return (
    <div className="mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 page-border-and-color font-RobotoMono w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] text-slate-950 dark:text-white">
      <h1 className={`page-title`}>Ticket to Space</h1>
      <p className="mt-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white  px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] xl:text-left text-sm xl:text-base">
        {`One person will be randomly selected to win an opportunity aboard a future Blue Origin rocket to space!`}
      </p>
      <div className="page-border-and-color">
        <div className="mt-5">
          <h2 className="text-sm font-semibold">Winners</h2>
          <div className="mt-3">
            {winners.map((winner: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <p className="text-xs">{winner}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
