import { useState } from 'react'

function Button({ children, onClick }: any) {
  return (
    <button
      className="border-style btn text-n3blue normal-case font-medium w-full  bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out text-1xl"
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
}: any) {
  const [dropdown, setDropdown] = useState(false)
  const [error, setError] = useState('')

  if (dropdown) {
    return (
      <div className="flex flex-col justify-center items-center gap-4">
        <p className="font-RobotoMono">Are you a vMooney Holder?</p>
        {error === 'invalid-lock' && (
          <p className="text-n3green ease-in duration-300">
            This wallet either doesn't have vMooney or your lock-time doesn't
            exceed June 9th
          </p>
        )}
        {error === 'no-wallet' && (
          <p className="text-n3green ease-in duration-300">
            Please connect a wallet that has vMooney, ensure that your lock-time
            exceeds June 9th
          </p>
        )}
        <Button
          onClick={() => {
            if (!account?.address) return setError('no-wallet')
            if (!validLock) return setError('invalid-lock')
            setState(2)
          }}
        >
          Yes
        </Button>
        <Button onClick={() => setState(1)}>No</Button>
        <button
          className="text-n3green hover:scale-[1.05] ease-in duration-150"
          onClick={() => setDropdown(false)}
        >
          Cancel ✖
        </button>
      </div>
    )
  }

  return <Button onClick={() => setDropdown(true)}>Enter Raffle</Button>
}
