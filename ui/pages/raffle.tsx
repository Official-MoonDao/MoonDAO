import { ExclamationCircleIcon, PhotographIcon } from '@heroicons/react/outline'
import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { discordOauthUrl, getUserDiscordData } from '../lib/discord'
import { checkUserData, submitRaffleForm } from '../lib/google-sheets'
import { useAccount } from '../lib/use-wagmi'
import { useVMOONEYBalance, useVMOONEYLock } from '../lib/ve-token'
import { BigNumber } from 'ethers/lib/ethers'
import MainCard from '../components/MainCard'
import ThirdwebEditionDropEmbed from '../components/ThirdwebEditionDropEmbed'

/*
STAGES:
  0) Check if wallet is connected and that it has vMooney
  1) Verify the user's twitter account
  2) Verify the user's discord account and email 
  3) Check if the user has already entered the raffle, submit raffle form
  4) Raffle submission success
  5) Error, user has already entered the raffle
*/

//The member's lock-time must exceed this date =>
const lockCutoff = +new Date('2023-06-09T00:00:00')

function StageContainer({ children, opacity75 }: any) {
  return (
    <div
      className={
        opacity75
          ? 'flex flex-col justify-center items-center animate-fadeInSlowTo75'
          : 'flex flex-col justify-center items-center animate-fadeInSlow text-center'
      }
    >
      {children}
    </div>
  )
}

function InputContainer({ children }: any) {
  return (
    <div className="flex flex-col justify-center items-center p-5 rounded-sm border-style backdropBlur">
      {children}
    </div>
  )
}

export default function Raffle({ userDiscordData }: any) {
  const { data: account } = useAccount()
  const { data: twitter } = useSession()
  const [state, setState] = useState(0)
  const [validLock, setValidLock] = useState(false)
  const { data: vMooneyLock, isLoading: vMooneyLockLoading } = useVMOONEYLock(
    '0x679d87D8640e66778c3419D164998E720D7495f6'
  )

  function Cancle({ stage }: any) {
    return (
      <button
        className="text-n3green hover:scale-[1.05] ease-in duration-150"
        onClick={async () => {
          stage === 1 ? setState(0) : await signOut()
        }}
      >
        {stage >= 4 ? 'Close ✖' : 'Cancel ✖'}
      </button>
    )
  }

  function AdvanceButton({ onClick, children }: any) {
    return (
      <button
        className={`m-4 border-style btn text-n3blue normal-case font-medium w-full  bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out text-[2vw] ${
          !account && 'btn-disabled'
        }`}
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
    console.log(validLock)
    if (state >= 4) return
    if (twitter?.user && account?.address && validLock) {
      userDiscordData.username && userDiscordData.email
        ? setState(3)
        : setState(2)
    } else setState(0)
  }, [twitter, account, vMooneyLock, userDiscordData])

  return (
    <MainCard>
      <div className="flex flex-col animate-fadeIn justify-center items-center">
        {state === 0 && (
          <StageContainer>
            <h2 className="text-[3.5vw] font-semibold font-GoodTimes">
              Zero G Raffle
            </h2>
            {account?.address && validLock ? (
              <p className="text-n3blue ease-in duration-300 text-[1.5vw]">
                Wallet is connected & has Mooney staked through June 9th
              </p>
            ) : validLock ? (
              <p className="text-n3green ease-in duration-300 text-[1.5vw]">
                This wallet either doesn't have vMooney or your lock-time
                doesn't exceed June 9th
              </p>
            ) : (
              <p className="text-white ease-in duration-300 text-[1.5vw]">
                Please connect a wallet that has vMooney, ensure that your
                lock-time exceeds June 9th
              </p>
            )}
            <AdvanceButton
              onClick={async () => {
                account?.address && validLock && setState(1)
              }}
            >
              Enter Raffle
            </AdvanceButton>
            <div className="alert m-4 bg-transparent border border-primary">
              <div>
                <PhotographIcon className="text-primary h-8 w-8" />
                <div className="flex flex-col gap-0.5 text-xs text-justify"></div>
                <p className="italic">
                  Check out the free{' '}
                  <span>
                    <Link href="/nfts">
                      <button className="text-n3blue    hover:scale-[1.05] duration-150 ease-in-ease-out">
                        Zero G NFT!
                      </button>
                    </Link>
                  </span>
                </p>
              </div>
            </div>
          </StageContainer>
        )}
        {state === 1 && (
          <StageContainer>
            <h2>Step 1: Verify your Twitter account</h2>
            <AdvanceButton
              onClick={async () => {
                await signIn()
              }}
            >
              Verify Twitter
            </AdvanceButton>
            <Cancle stage={1} />
          </StageContainer>
        )}
        {state === 2 && (
          <StageContainer>
            <h2>Step 2: Verify your Discord account</h2>
            <AdvanceButton>
              <Link href={discordOauthUrl.preview}>Verify Discord</Link>
            </AdvanceButton>
            <Cancle stage={2} />
          </StageContainer>
        )}
        {state === 3 && (
          <StageContainer opacity75>
            <h2 className="my-8">Step 3: Review and submit the form</h2>
            <div className="galaxy-bg w-full rounded-2xl absolute h-full z-[-10] top-0 ease-in duration-[5s] opacity-[0.75]" />
            <form className="flex gap-4 flex-col justify-center items-center p-4 w-[50vw] text-center">
              <InputContainer>
                <label>
                  Twitter Display Name:
                  <input
                    className="flex flex-col text-black w-full rounded-md p-2"
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
                    className="flex flex-col text-black w-full rounded-md p-2"
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
                    className="flex flex-col text-black w-full rounded-md p-2"
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
                    className="flex flex-col text-black w-full rounded-md p-2"
                    type="text"
                    readOnly
                    value={userDiscordData.email}
                  />
                </label>
              </InputContainer>
              <button
                className="m-8 text-n3blue"
                onClick={async (e) => {
                  e.preventDefault()
                  const userData = {
                    twitterName: twitter?.user?.name,
                    userDiscordData,
                    walletAddress: account.address,
                    email: userDiscordData.email,
                  }
                  //check if wallet, twitter, discord or email has already been used
                  if (await checkUserData(userData)) {
                    console.log('user has already entered the raffle')
                    setState(5)
                    return setTimeout(async () => {
                      await signOut()
                    }, 5000)
                  }

                  await submitRaffleForm(userData).then(() => {
                    setState(4)
                    return setTimeout(async () => {
                      await signOut()
                    }, 5000)
                  })
                }}
              >
                Submit ✔
              </button>
            </form>
            <div className="relative bottom-6">
              <Cancle stage={2} />
            </div>
          </StageContainer>
        )}
        {state === 4 && (
          <StageContainer>
            <h2 className="text-[lightgreen]">
              Thanks for entering the raffle!
            </h2>
          </StageContainer>
        )}
        {state === 5 && (
          <StageContainer>
            <h2 className="text-[orangered]">
              You've already entered the raffle, you may only enter one time
            </h2>
          </StageContainer>
        )}
      </div>
    </MainCard>
  )
}

export async function getServerSideProps(context: any) {
  const code = context?.query?.code
  let userDiscordData = {}
  if (code) userDiscordData = (await getUserDiscordData(code)) || {}
  console.log('code:' + code, 'data:' + userDiscordData)
  return {
    props: {
      userDiscordData,
    },
  }
}
