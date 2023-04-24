import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useWaitForTransaction } from 'wagmi'
import { discordOauthUrl } from '../../lib/discord'
import { checkUserDataRaffle, submitRaffleForm } from '../../lib/google-sheets'
import {
  useBalanceTicketZeroG,
  useMintTicketZeroG,
} from '../../lib/zero-g-sweepstakes'
import EnterRaffleButton from './EnterRaffleButton'
import InputContainer from './InputContainer'
import ReservationRaffleLayout from './ReservationRaffleLayout'
import StageContainer from './StageContainer'
import SweepstakesSupply from './SweepstakesSupply'

/*
STAGES:
  0. Check if wallet is connected and that it has vMooney
  1. Alt Entry if no vMooney
  2. Verify the user's twitter account
  3. Verify the user's discord account and email 
  4. Review form, mint zero-g ticket
  5. Raffle submission success
  6. Error
*/

export default function ZeroGRaffle({
  userDiscordData,
  router,
  account,
  validLock,
  supply,
}: any) {
  const { data: twitter } = useSession()

  const [state, setState] = useState<number>(0)
  const [error, setError] = useState<string>('')

  const { data: mintData, write: mint } = useMintTicketZeroG()
  const { isLoading: mintIsLoading, isSuccess: mintSuccess } =
    useWaitForTransaction({
      hash: mintData?.hash,
    })

  const { data: hasTicket } = useBalanceTicketZeroG(account?.address)

  const formRef: any = useRef()

  function errorStage(message: string) {
    setError(message)
    setState(6)
  }

  function Cancel() {
    return (
      <button
        className="mt-4 tracking-wide btn text-gray-100 normal-case font-medium font-GoodTimes w-full bg-red-500 hover:bg-red-600 hover:text-white duration-[0.6s] ease-in-ease-out text-1xl"
        onClick={async () => {
          await signOut()
        }}
      >
        {state >= 5 ? 'Close ✖' : 'Cancel ✖'}
      </button>
    )
  }

  function AdvanceButton({ onClick, children }: any) {
    return (
      <button
        className="border-style mt-4 tracking-wide btn text-n3blue normal-case font-medium font-GoodTimes w-full  bg-transparent hover:bg-n3blue hover:text-white duration-[0.6s] ease-in-ease-out text-1xl"
        onClick={onClick}
      >
        {children}
      </button>
    )
  }

  useEffect(() => {
    if (state >= 5 || state === 1) return
    if (twitter?.user && account?.address && validLock) {
      userDiscordData.username && userDiscordData.email
        ? setState(4)
        : setState(3)
    } else setState(0)
  }, [twitter?.user, account, validLock, userDiscordData])

  useEffect(() => {
    if (state === 4 && mintData && !mintIsLoading && mintSuccess && hasTicket) {
      setTimeout(() => {
        if (+hasTicket.toString() === 1) setState(5)
        if (+hasTicket.toString() < 1)
          errorStage(
            'This wallet does not have vMooney! Please do not switch wallets!'
          )
      }, 1000)
    }

    if (state === 5) {
      const userData = {
        twitterName: twitter?.user?.name,
        userDiscordData,
        walletAddress: account.address,
        email: userDiscordData.email,
      }
      ;(async () => {
        if (!(await checkUserDataRaffle(userData)))
          await submitRaffleForm(userData)
      })()
    }
  }, [mintIsLoading, mintSuccess, hasTicket, state, formRef])

  return (
    <ReservationRaffleLayout>
      <div className="flex flex-col animate-fadeIn justify-center items-center">
        {state === 0 && (
          <StageContainer>
            <div className="w-full">
              <h2 className="card-title text-center font-display tracking-wider text-2xl lg:text-3xl font-semibold text-yellow-50">
                Sweepstakes
              </h2>
              <SweepstakesSupply supply={supply} />
              <div className="my-3">
                <Link href="/zero-g/rules">
                  <a
                    className={`mt-5 block text-md font-GoodTimes font-semibold bg-gradient-to-r from-n3blue  to-n3blue text-transparent bg-clip-text`}
                  >
                    Terms & Conditions →
                  </a>
                </Link>
              </div>
              <p className="italic text-[75%] opacity-[0.5]">
                *please read the terms and conditions*
              </p>
            </div>
            <EnterRaffleButton
              setState={(stage: any) => setState(stage)}
              account={account}
              validLock={validLock}
              hasTicket={hasTicket}
            />
          </StageContainer>
        )}
        {state === 1 && (
          <StageContainer>
            <h2 className="text-3xl font-semibold font-RobotoMono mb-1">
              Alternative Entry
            </h2>
            <p className="my-4 leading-relaxed text-center">
              {`
              As an alternative means of entry in the Promotion, each
              prospective entrant may submit a mail-in entry in the form of a
              handwritten self-addressed, stamped envelope that contains the
              AMOE Registration Data.`}
            </p>

            <Link href="/zero-g/rules/alt-entry">
              <a
                className={`mt-5 hover:scale-105 duration-150 block text-md font-GoodTimes font-semibold bg-gradient-to-r from-n3blue  to-n3blue text-transparent bg-clip-text`}
              >
                {' '}
                Alt Entry Details →
              </a>
            </Link>

            <button
              className="mt-5 flex items-center bg-[grey] text-lg rounded px-2 py-1 text-gray-100 hover:scale-[1.05] hover:text-white hover:bg-n3blue ease-in duration-150"
              onClick={() => setState(0)}
            >
              {'← Back'}
            </button>
          </StageContainer>
        )}
        {state === 2 && (
          <StageContainer>
            <h2 className="text-n3blue">Step 1: Verify your Twitter account</h2>
            <AdvanceButton
              onClick={async () => {
                await signIn()
              }}
            >
              Verify Twitter
            </AdvanceButton>
            <Cancel />
          </StageContainer>
        )}
        {state === 3 && (
          <StageContainer>
            <h2 className="text-n3blue">Step 2: Verify your Discord account</h2>
            <AdvanceButton
              onClick={() => router.push(discordOauthUrl.production)}
            >
              Verify Discord
            </AdvanceButton>
            <Cancel />
          </StageContainer>
        )}
        {state === 4 && (
          <StageContainer opacity75 forwardRef={formRef}>
            <h2 className="my-8 px-8 text-yellow-50 lg:text-lg tracking-wide">
              {`Step 3: Review your info and mint your Ticket to Zero-G.`}
            </h2>
            <div className="galaxy-bg w-full rounded-2xl absolute h-full z-[-10] left-0 top-0 ease-in duration-[5s] opacity-[0.75]" />
            <form className="flex gap-4 flex-col justify-center items-center p-4 w-full text-center">
              <InputContainer>
                <label className="text-lg">
                  Twitter Display Name:
                  <input
                    className="mt-2 flex flex-col bg-slate-900 text-white w-full rounded-md p-2"
                    type="text"
                    readOnly
                    value={twitter?.user?.name || ''}
                  />
                </label>
              </InputContainer>
              <InputContainer>
                <label className="text-lg">
                  Wallet Address:
                  <input
                    className="mt-2 flex flex-col bg-slate-900 text-white w-full rounded-md p-2"
                    type="text"
                    readOnly
                    value={account?.address}
                  />
                </label>
              </InputContainer>
              <InputContainer>
                <label className="text-lg">
                  Discord Username:
                  <input
                    className="mt-2 flex flex-col bg-slate-900 text-white w-full rounded-md p-2"
                    type="text"
                    readOnly
                    value={userDiscordData.username}
                  />
                </label>
              </InputContainer>
              <InputContainer>
                <label className="text-lg">
                  Discord Email:
                  <input
                    className="mt-2 flex flex-col bg-slate-900 text-white w-full rounded-md p-2"
                    type="text"
                    readOnly
                    value={userDiscordData.email}
                  />
                </label>
              </InputContainer>
              <button
                className="border-style mt-4 tracking-wide btn text-n3blue normal-case font-medium font-GoodTimes w-full  bg-transparent hover:bg-n3blue hover:text-white duration-[0.6s] ease-in-ease-out text-1xl"
                disabled={mintIsLoading}
                onClick={async (e) => {
                  e.preventDefault()
                  const userData = {
                    twitterName: twitter?.user?.name,
                    userDiscordData,
                    walletAddress: account.address,
                    email: userDiscordData.email,
                  }
                  //check if wallet, twitter, discord or email has already been used
                  try {
                    if (await checkUserDataRaffle(userData)) {
                      //error stage
                      return errorStage('You have already entered the raffle!')
                    }
                  } catch (err) {
                    return errorStage('Unkown Error, contact support')
                  }

                  //mint nft
                  try {
                    await mint()
                  } catch (err: any) {
                    console.log(err)
                    return errorStage(err.message)
                  }
                }}
              >
                {mintIsLoading ? '...loading' : 'Mint Ticket to Zero-G'}
              </button>
              <Cancel />
            </form>
          </StageContainer>
        )}
        {state === 5 && (
          <StageContainer>
            <h2 className="text-n3blue m-4 lg:text-lg">
              Thanks for entering the sweepstakes!
            </h2>
            <button
              className="my-4 border-2 rounded-2xl btn border-[#1DA1F2] text-[#1DA1F2] normal-case font-medium font-GoodTimes w-full  bg-transparent hover:bg-[#1DA1F2] hover:text-white duration-[0.6s] ease-in-ease-out"
              onClick={async () => {
                await signOut()
                window.open(
                  'https://twitter.com/intent/tweet?text=Just%20entered%20to%20win%20a%20free%20zero%20gravity%20flight%20with%20%40OfficialMoonDAO%20and%20their%20%23TickettoZeroG%20--%20claim%20yours%20here%20https%3A//app.moondao.com/zero-g%20%22%3EShare'
                )
              }}
            >
              Share on Twitter
            </button>
            <Cancel />
          </StageContainer>
        )}
        {state === 6 && (
          <StageContainer>
            <h2 className="text-n3green m-4 lg:text-lg">{error}</h2>
            <Cancel />
          </StageContainer>
        )}
        {/* DEV BUTTONS FOR STAGES, REMOVE BEFORE DEPLOY
        <div className="absolute left-[600px] flex flex-col gap-4 bg-[blue] w-3/4 text-center my-4">
          <h1>Dev Buttons </h1>
          <div className="flex gap-[50%]">
            <button onClick={() => setState(state > 0 ? state - 1 : state)}>
              previous stage
            </button>
            <button onClick={() => setState(state < 6 ? state + 1 : state)}>
              next stage
            </button>
          </div>
        </div>*/}
      </div>
    </ReservationRaffleLayout>
  )
}
