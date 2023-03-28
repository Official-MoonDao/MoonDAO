import { useState } from 'react'
import { useBalanceTicketZeroG } from '../../lib/zero-g-raffle'

function Button({ children, onClick }: any) {
  return (
    <button
      className="border-style mt-4 tracking-wide btn text-n3blue normal-case font-medium font-GoodTimes w-full  bg-transparent hover:bg-n3blue hover:text-white duration-[0.6s] ease-in-ease-out text-1xl"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function EnterRaffleButton({
  setState,
  account,
  validLock,
  label = 'Enter Raffle',
}: any) {
  const [dropdown, setDropdown] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const { data: hasTicket } = useBalanceTicketZeroG(account?.address)

  if (dropdown) {
    return (
      <div className="flex flex-col justify-center items-center gap-4">
        <p className="font-RobotoMono mt-3 text-lg">Are you a vMooney Holder?</p>
        {error !== '' && (
          <p className="text-n3green ease-in duration-300">{error}</p>
        )}
        <Button
          onClick={async () => {
            if (!account?.address)
              return setError('Please connect a wallet that has vMooney')
            if (!validLock) return setError('This wallet does not have vMooney')
            await hasTicket
            if (+hasTicket.toString() === 1)
              return setError('You have already entered the raffle!')
            setState(2)
          }}
        >
          Yes
        </Button>
        <Button onClick={async () => setState(1)}>No</Button>
        <button
          className="mt-4 tracking-wide btn text-gray-100 normal-case font-medium font-GoodTimes w-full bg-red-500 hover:bg-red-600 hover:text-white duration-[0.6s] ease-in-ease-out text-1xl"
          onClick={() => setDropdown(false)}
        >
          Cancel ✖
        </button>
      </div>
    )
  }

  return <Button onClick={() => setDropdown(true)}>{label}</Button>
}
