import VotingEscrow from 'const/abis/VotingEscrow.json'
import { MOONEY_ADDRESSES } from 'const/config'
import { BigNumber } from 'ethers'
import { useContext, useEffect, useRef, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import {
  checkUserDataReservation,
  submitReservation,
} from '../../lib/zero-g/google-sheets'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import EnterRaffleButton from './EnterRaffleButton'
import InputContainer from './InputContainer'
import ReservationRaffleLayout from './ReservationRaffleLayout'
import StageContainer from './StageContainer'

export default function Reservations({ sweepstakesContract }: any) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const address = account?.address
  const [state, setState] = useState(0)
  const [error, setError] = useState('')

  const [validLock, setValidLock] = useState(false)

  const vMooneyContract = useContract({
    chain: selectedChain,
    address: MOONEY_ADDRESSES[chainSlug],
    abi: VotingEscrow as any,
  })

  const { data: vMooneyLock } = useRead({
    contract: vMooneyContract,
    method: 'locked',
    params: [address],
  })
  const altEmailInput: any = useRef()
  const altNameInput: any = useRef()
  const holderEmailInput: any = useRef()
  const holderNameInput: any = useRef()

  function reset() {
    setTimeout(() => {
      setState(0)
    }, 5000)
  }

  function Cancel() {
    return (
      <button
        className="mt-4 tracking-wide btn text-gray-100 normal-case font-medium font-GoodTimes w-full bg-red-500 hover:bg-red-600 hover:text-white duration-[0.6s] ease-in-ease-out text-1xl"
        onClick={async () => {
          setState(0)
        }}
      >
        {'Cancel ✖'}
      </button>
    )
  }

  function SubmitButton() {
    return (
      <div className="flex flex-col justify-center items-center w-full">
        {error === 'no-wallet' && (
          <p className="text-n3green ease-in duration-300">
            Please connect a wallet that has vMooney
          </p>
        )}
        {error === 'invalid-lock' && (
          <p className="text-n3green ease-in duration-300">
            This wallet doesn't have any vMooney
          </p>
        )}
        {error === 'invalid-input' && (
          <p className="text-n3green ease-in duration-300">
            Make sure you include a valid email and your full name
          </p>
        )}
        <button
          className="mt-4 tracking-wide btn text-gray-100 normal-case font-medium font-GoodTimes hover:bg-[orange] w-full bg-n3blue hover:text-white duration-[0.6s] ease-in-ease-out"
          onClick={async () => {
            let fullName, email
            if (state === 1) {
              fullName = altNameInput.current.value
              email = altEmailInput.current.value
              if (
                fullName.trim() === '' ||
                fullName.length < 5 ||
                !email.includes('@') ||
                email.trim() === ''
              )
                return setError('invalid-input')
              if (!(await checkUserDataReservation({ fullName, email }))) {
                await submitReservation({
                  fullName,
                  email,
                })

                setState(3)
                return reset()
              } else {
                setState(4)
                reset()
              }
            }
            if (state === 2) {
              //check if vMooneyHolder
              if (!address) return setError('no-wallet')
              if (!validLock) return setError('invalid-lock')
              fullName = holderNameInput.current.value
              email = holderEmailInput.current.value
              if (
                fullName.trim() === '' ||
                fullName.length < 5 ||
                !email.includes('@') ||
                email.trim() === ''
              )
                return setError('invalid-input')
              if (
                !(await checkUserDataReservation({
                  fullName: fullName.trim(),
                  email: email.trim(),
                  walletAddress: address,
                }))
              ) {
                await submitReservation({
                  fullName,
                  email,
                  isVMOONEYHolder: true,
                  walletAddress: address,
                })
                setState(3)
                return reset()
              } else {
                setState(4)
                return reset()
              }
            }
          }}
        >
          Submit ✔
        </button>
      </div>
    )
  }

  useEffect(() => {
    if (vMooneyLock)
      setValidLock(
        vMooneyLock &&
          vMooneyLock[1] != 0 &&
          BigNumber.from(+new Date()).lte(vMooneyLock[1].mul(1000))
      )
  }, [vMooneyLock])

  return (
    <ReservationRaffleLayout title="Reservations">
      {state === 0 && (
        <StageContainer>
          <EnterRaffleButton
            setState={(stage: number) => setState(stage)}
            address={address}
            validLock={validLock}
            label="Make a Reservation"
          />
        </StageContainer>
      )}
      {state === 1 && (
        <StageContainer>
          <InputContainer>
            <label className="text-lg">
              {'Full Name:'}
              <input
                className="mt-2 flex flex-col bg-slate-900 text-white w-full rounded-md p-2"
                placeholder="first and last name"
                ref={altNameInput}
              />
            </label>
          </InputContainer>
          <InputContainer>
            <label className="text-lg">
              {'Email:'}
              <input
                className="mt-2 flex flex-col bg-slate-900 text-white w-full rounded-md p-2"
                placeholder="email address"
                ref={altEmailInput}
              />
            </label>
          </InputContainer>
          <div className="flex flex-col justify-center items-center">
            <SubmitButton />
            <Cancel />
          </div>
        </StageContainer>
      )}
      {state === 2 && (
        <StageContainer>
          <InputContainer>
            <label>
              {'Full Name:'}
              <input
                className="flex flex-col text-black w-full rounded-md p-2"
                placeholder="first and last name"
                ref={holderNameInput}
              />
            </label>
          </InputContainer>
          <InputContainer>
            <label>
              {'Email:'}
              <input
                className="flex flex-col text-black w-full rounded-md p-2"
                placeholder="email address"
                ref={holderEmailInput}
              />
            </label>
          </InputContainer>
          <div className="flex flex-col justify-center items-center">
            <SubmitButton />
            <Cancel />
          </div>
        </StageContainer>
      )}
      {state === 3 && (
        <StageContainer>
          <p className="mt-1 text-n3blue ease-in duration-300">
            You have succefully made a reservation!
          </p>
        </StageContainer>
      )}
      {state === 4 && (
        <StageContainer>
          <p className="mt-1 text-n3green ease-in duration-300">
            Oops, looks like you have already reserved a spot!
          </p>
        </StageContainer>
      )}
    </ReservationRaffleLayout>
  )
}

/*
Reservation Stages:

0. Start
1. Alt Entry
2. Holder Entry
3. Success
4. Error: User already made a reservation
*/
