import { ApplicationCommandManager } from 'discord.js'
import { BigNumber } from 'ethers'
import { useEffect, useRef, useState } from 'react'
import {
  checkUserDataReservation,
  submitReservation,
} from '../../lib/google-sheets'
import { useAccount } from '../../lib/use-wagmi'
import { useVMOONEYLock } from '../../lib/ve-token'
import MainCard from '../layout/MainCard'
import EnterRaffleButton from './EnterRaffleButton'
import InputContainer from './InputContainer'
import StageContainer from './StageContainer'

const lockCutoff = +new Date('2023-06-09T00:00:00')

export default function Reservations() {
  const { data: account } = useAccount()
  const [state, setState] = useState(0)
  const [error, setError] = useState('')
  const [userData, setUserData] = useState({
    fullName: '',
    email: '',
    isVMOONEYHolder: false,
  })

  const [validLock, setValidLock] = useState(false)
  const { data: vMooneyLock, isLoading: vMooneyLockLoading } = useVMOONEYLock(
    '0x679d87D8640e66778c3419D164998E720D7495f6'
  )
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
        className="text-n3green hover:scale-[1.05] ease-in duration-150 w-full text-center"
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
      <div className="flex flex-col">
        {error === 'no-wallet' && (
          <p className="text-n3green ease-in duration-300">
            Please connect a wallet that has vMooney, ensure that your lock-time
            exceeds June 9th
          </p>
        )}
        {error === 'invalid-lock' && (
          <p className="text-n3green ease-in duration-300">
            This wallet either doesn't have vMooney or your lock-time doesn't
            exceed June 9th
          </p>
        )}
        {error === 'invalid-input' && (
          <p className="text-n3green ease-in duration-300">
            Make sure you include a valid email and your full name
          </p>
        )}
        <button
          className="m-8 text-n3blue"
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
              if (!account.address) return setError('no-wallet')
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
                  fullName,
                  email,
                  walletAddress: account?.address,
                }))
              ) {
                await submitReservation({
                  fullName,
                  email,
                  isVMOONEYHolder: true,
                  walletAddress: account?.address,
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
    if (vMooneyLock && vMooneyLock[1] !== 0) {
      setValidLock(BigNumber.from(lockCutoff).lte(vMooneyLock[1].mul(1000)))
    }
  }, [vMooneyLock])

  return (
    <MainCard title="Reservations">
      {state === 0 && (
        <StageContainer>
          <EnterRaffleButton
            setState={(stage: number) => setState(stage)}
            account={account}
            validLock={validLock}
            label="Make a Reservation"
          />
        </StageContainer>
      )}
      {state === 1 && (
        <StageContainer>
          <InputContainer>
            <label>
              {'Full Name:'}
              <input
                className="flex flex-col text-black w-full rounded-md p-2"
                placeholder="enter your first and last name"
                ref={altNameInput}
              />
            </label>
          </InputContainer>
          <InputContainer>
            <label>
              {'Email:'}
              <input
                className="flex flex-col text-black w-full rounded-md p-2"
                placeholder="enter your email address"
                ref={altEmailInput}
              />
            </label>
          </InputContainer>
          <SubmitButton />
          <Cancel />
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
          <SubmitButton />
          <Cancel />
        </StageContainer>
      )}
      {state === 3 && (
        <StageContainer>
          <p className="text-n3blue ease-in duration-300">
            You have succefully made a reservation!
          </p>
        </StageContainer>
      )}
      {state === 4 && (
        <StageContainer>
          <p className="text-n3green ease-in duration-300">
            Oops, looks like you have already reserved a spot!
          </p>
        </StageContainer>
      )}
    </MainCard>
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
