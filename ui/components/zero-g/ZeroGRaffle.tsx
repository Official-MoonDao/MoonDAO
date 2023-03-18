import { InformationCircleIcon } from '@heroicons/react/outline'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useWaitForTransaction } from 'wagmi'
import { discordOauthUrl } from '../../lib/discord'
import { checkUserDataRaffle, submitRaffleForm } from '../../lib/google-sheets'
import { useAccount, useSigner } from '../../lib/use-wagmi'
import { useVMOONEYLock } from '../../lib/ve-token'
import {
  useBalanceTicketZeroG,
  useMintTicketZeroG,
} from '../../lib/zero-g-raffle'
import { BigNumber } from 'ethers/lib/ethers'
import GradientLink from '../layout/GradientLink'
import MainCard from '../layout/MainCard'
import EnterRaffleButton from './EnterRaffleButton'
import InputContainer from './InputContainer'
import RaffleNFTDetail from './RaffleNFTDetail'
import StageContainer from './StageContainer'

/*
STAGES:
  0. Check if wallet is connected and that it has vMooney
  1. Alt Entry if no vMooney
  2. Verify the user's twitter account
  3. Verify the user's discord account and email 
  4. Check if the user has already entered the raffle, submit raffle form
  5. Raffle submission success & nft minting
  6. Error, user has already entered the raffle
*/

//The member's lock-time must exceed this date =>
const lockCutoff = +new Date('2023-06-09T00:00:00')

export default function ZeroGRaffle({ userDiscordData, router }: any) {
  const { data: account } = useAccount()
  const { data: signer } = useSigner()
  const { data: twitter } = useSession()
  const { data: vMooneyLock, isLoading: vMooneyLockLoading } = useVMOONEYLock(
    '0x679d87D8640e66778c3419D164998E720D7495f6'
  )
  const [validLock, setValidLock] = useState<boolean>(false)

  const [state, setState] = useState<number>(0)
  const [error, setError] = useState<string>('')

  const { data: mintData, write: mint } = useMintTicketZeroG()
  const { isLoading: mintIsLoading, isSuccess: mintSuccess } =
    useWaitForTransaction({
      hash: mintData?.hash,
    })
  const { data: hasTicket } = useBalanceTicketZeroG(account?.address)

  function errorStage(message: string) {
    setError(message)
    setState(6)
  }

  function Cancel() {
    return (
      <button
        className="border-n3green border-2 text-n3green hover:scale-[1.05] ease-in duration-150 w-1/2 rounded-2xl text-center py-2"
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
        className={`border-style btn text-n3blue normal-case font-medium w-full  bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out text-1xl my-4`}
        onClick={onClick}
      >
        {children}
      </button>
    )
  }

  useEffect(() => {
    if (vMooneyLock && vMooneyLock[1] !== 0) {
      setValidLock(BigNumber.from(lockCutoff).lte(vMooneyLock[1].mul(1000)))
    }
    if (state >= 5 || state === 1) return
    if (twitter?.user && account?.address) {
      userDiscordData.username && userDiscordData.email
        ? setState(4)
        : setState(3)
    } else setState(0)
  }, [twitter, account, vMooneyLock, userDiscordData])

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
  }, [mintIsLoading, mintSuccess, hasTicket, state])

  return (
    <MainCard>
      <div className="flex flex-col animate-fadeIn justify-center items-center">
        {state === 0 && (
          <StageContainer>
            <div className="w-full">
              <h2 className="text-3xl w-1/2 font-semibold">Raffle</h2>
              <div className="my-2">
                <GradientLink
                  text={'Rules'}
                  href="/zero-g/rules"
                  internal={false}
                  textSize={'md'}
                ></GradientLink>
              </div>
            </div>
            <EnterRaffleButton
              setState={(stage: any) => setState(stage)}
              account={account}
              validLock={validLock}
            />
          </StageContainer>
        )}
        {state === 1 && (
          <StageContainer>
            <h2 className="text-3xl font-semibold font-RobotoMono mb-1">
              Alternative Entry
            </h2>
            <p className="my-4">
              {`
              As an alternative means of entry in the Promotion, each
              prospective entrant may submit a mail-in entry in the form of a
              handwritten self-addressed, stamped envelope that contains the
              AMOE Registration Data.`}
            </p>
            <GradientLink
              text={'Alt Entry Details'}
              href="/zero-g/rules/alt-entry"
              internal={false}
              textSize={'md'}
            ></GradientLink>
            <button
              className="text-n3blue hover:scale-[1.05] ease-in duration-150 my-4 relative right-[2%]"
              onClick={() => setState(0)}
            >
              {'👈 Back'}
            </button>
          </StageContainer>
        )}
        {state === 2 && (
          <StageContainer>
            <h2>Step 1: Verify your Twitter account</h2>
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
            <h2>Step 2: Verify your Discord account</h2>
            <AdvanceButton onClick={() => router.push(discordOauthUrl.dev)}>
              Verify Discord
            </AdvanceButton>
            <Cancel />
          </StageContainer>
        )}
        {state === 4 && (
          <StageContainer opacity75>
            <h2 className="my-8 px-8">
              {`Step 3: Review your info and mint your Ticket to Zero-G.`}
            </h2>
            <div className="galaxy-bg w-full rounded-2xl absolute h-full z-[-10] left-0 top-0 ease-in duration-[5s] opacity-[0.75]" />
            <form className="flex gap-4 flex-col justify-center items-center p-4 w-full text-center">
              <InputContainer>
                <label>
                  Twitter Display Name:
                  <input
                    className="flex flex-col text-black w-full rounded-md p-2 my-2"
                    type="text"
                    readOnly
                    value={twitter?.user?.name || ''}
                  />
                </label>
              </InputContainer>
              <InputContainer>
                <label>
                  Wallet Address:
                  <input
                    className="flex flex-col text-black w-full rounded-md p-2 my-2"
                    type="text"
                    readOnly
                    value={account?.address}
                  />
                </label>
              </InputContainer>
              <InputContainer>
                <label>
                  Discord Username:
                  <input
                    className="flex flex-col text-black w-full rounded-md p-2 my-2"
                    type="text"
                    readOnly
                    value={userDiscordData.username}
                  />
                </label>
              </InputContainer>
              <InputContainer>
                <label>
                  Discord Email:
                  <input
                    className="flex flex-col text-black w-full rounded-md p-2 my-2"
                    type="text"
                    readOnly
                    value={userDiscordData.email}
                  />
                </label>
              </InputContainer>
              <button
                className="border-style btn text-n3blue normal-case font-medium w-full  bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out text-1xl"
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
            </form>
            <Cancel />
          </StageContainer>
        )}
        {state === 5 && (
          <StageContainer>
            <h2 className="text-n3blue m-4">Thanks for entering the raffle!</h2>
            <Cancel />
          </StageContainer>
        )}
        {state === 6 && (
          <StageContainer>
            <h2 className="text-n3green m-4">{error}</h2>
            <Cancel />
          </StageContainer>
        )}
      </div>
    </MainCard>
  )
}
