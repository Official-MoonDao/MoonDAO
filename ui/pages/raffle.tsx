import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { discordOauthUrl, getUserDiscordData } from '../lib/discord'
import { checkUserData, submitRaffleForm } from '../lib/google-sheets'
import { useAccount } from '../lib/use-wagmi'
import { useVMOONEYBalance } from '../lib/ve-token'
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

function StageContainer({ children, opacity75 }: any) {
  return (
    <div
      className={
        opacity75
          ? 'flex flex-col justify-center items-center animate-fadeInSlowTo75'
          : 'flex flex-col justify-center items-center animate-fadeInSlow'
      }
    >
      {children}
    </div>
  )
}

function InputContainer({ children }: any) {
  return (
    <div className="flex flex-col justify-center items-center glass p-4 rounded-sm">
      {children}
    </div>
  )
}

export default function Raffle({ userDiscordData }: any) {
  const { data: account } = useAccount()
  const { data: twitter } = useSession()
  const [state, setState] = useState(0)
  const { data: vMooneyBalance, isLoading: vMooneyBalanceLoading } =
    useVMOONEYBalance('0x679d87D8640e66778c3419D164998E720D7495f6')
  function Cancle(stage: any) {
    return (
      <button
        className="text-[coral] hover:scale-[1.05] ease-in duration-150"
        onClick={async () => {
          stage === 1 ? setState(0) : await signOut()
        }}
      >
        {stage >= 4 ? 'Close ✖' : 'Cancel ✖'}
      </button>
    )
  }

  useEffect(() => {
    if (state >= 4) return
    if (twitter?.user && account?.address && vMooneyBalance?.formatted > 0) {
      userDiscordData.username && userDiscordData.email
        ? setState(3)
        : setState(2)
    } else setState(0)
    console.log(userDiscordData)
  }, [twitter, account, vMooneyBalance, userDiscordData])

  return (
    <MainCard>
      <div className="flex flex-col animate-fadeIn justify-center items-center">
        {state === 0 && (
          <StageContainer>
            <h2 className="text-[3.5vw]">Zero G Charter Raffle</h2>
            <button
              className="text-raffleOrange text-[2.5vw] hover:scale-[1.075] ease-in-ease-out duration-500 my-4 glass p-2 rounded-md"
              onClick={async () => {
                account?.address && vMooneyBalance?.formatted > 0 && setState(1)
              }}
            >
              Enter Raffle
            </button>
            {account?.address && vMooneyBalance?.formatted > 0 ? (
              <p className="text-[lightgreen] ease-in duration-300">
                Wallet is connected & has vMooney!
              </p>
            ) : vMooneyBalance?.formatted <= 0 ? (
              <p className="text-[orangered] ease-in duration-300">
                This wallet doesn't have any vMooney, please lock some Mooney or
                try another wallet
              </p>
            ) : (
              <p className="text-[orangered] ease-in duration-300">
                Please connect a wallet that has vMooney
              </p>
            )}
            <div className="flex justify-center bg-[#d1d1d150] rounded-md px-2 m-4">
              <p className="italic">
                Check out the free{' '}
                <span>
                  <Link href="/nfts">
                    <button className="text-[cyan]    hover:scale-[1.05] duration-150 ease-in-ease-out">
                      Zero G NFT!
                    </button>
                  </Link>
                </span>
              </p>
            </div>
          </StageContainer>
        )}
        {state === 1 && (
          <StageContainer>
            <h2>Step 1: Verify your Twitter account</h2>
            <button
              className="text-[cyan] text-[2.5vw] hover:scale-[1.1] rounded-md glass p-2 ease-in-ease-out duration-300 my-6"
              onClick={async () => {
                await signIn()
              }}
            >
              Verify Twitter
            </button>
            <Cancle stage={1} />
          </StageContainer>
        )}
        {state === 2 && (
          <StageContainer>
            <h2>Step 2: Verify your Discord account</h2>
            <button className="text-[#5e27b0] text-[2.5vw] hover:scale-[1.1] ease-in-ease-out duration-300 my-4 p-2 glass rounded-md">
              <Link href={discordOauthUrl.preview}>Verify Discord</Link>
            </button>
            <Cancle stage={2} />
          </StageContainer>
        )}
        {state === 3 && (
          <StageContainer opacity75>
            <h2 className="my-8">Step 3: Review and submit the form</h2>
            <div className="galaxy-bg w-full rounded-2xl absolute h-full z-[-10] top-0 ease-in duration-[5s] opacity-[0.75]" />
            <form className="flex gap-4 flex-col justify-center items-center p-4 w-[50vw] text-center">
              <InputContainer>
                <label className="text-[cyan]">
                  Twitter Display Name:
                  <input
                    className="flex flex-col text-black w-full"
                    type="text"
                    readOnly
                    value={twitter?.user?.name || ''}
                  />
                </label>
              </InputContainer>
              <InputContainer>
                <label className="text-[orange]">
                  Wallet Address:
                  <input
                    className="flex flex-col text-black w-full"
                    type="text"
                    readOnly
                    value={account?.address}
                  />
                </label>
              </InputContainer>
              <InputContainer>
                <label className="text-[#a57ad6]">
                  Discord Username:
                  <input
                    className="flex flex-col text-black w-full"
                    type="text"
                    readOnly
                    value={userDiscordData.username}
                  />
                </label>
              </InputContainer>
              <InputContainer>
                <label className="text-[#a57ad6]">
                  Discord Email:
                  <input
                    className="flex flex-col text-black w-full"
                    type="text"
                    readOnly
                    value={userDiscordData.email}
                  />
                </label>
              </InputContainer>
              <button
                className="m-8 text-[lightgreen]"
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
                    return setState(5)
                  }

                  await submitRaffleForm(userData).then(() => {
                    setState(4)
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
            <div>
              <h2>{`(optional) Claim a zero-g NFT!`}</h2>
            </div>
            <Cancle />
          </StageContainer>
        )}
        {state === 5 && (
          <StageContainer>
            <h2 className="text-[orangered]">
              You've already entered the raffle, you may only enter one time
            </h2>
            <div>
              <h2>{`(optional) Claim a zero-g NFT!`}</h2>
            </div>
            <Cancle />
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
