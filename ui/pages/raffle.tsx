import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getUserDiscordData } from '../lib/discord'
import { submitRaffleForm } from '../lib/submit-raffle-form'
import { useAccount } from '../lib/use-wagmi'
import MainCard from '../components/MainCard'

export default function Raffle({ userDiscordData }: any) {
  const { data: account } = useAccount()
  const { data: twitter } = useSession()
  const [state, setState] = useState(0)

  useEffect(() => {
    if (twitter?.user && account?.address) {
      userDiscordData.username && userDiscordData.email
        ? setState(3)
        : setState(2)
    } else setState(0)
  }, [twitter, account])

  if (state === 0 || !account?.address) {
    return (
      <div>
        <MainCard>
          <h2>Zero G Charter Raffle</h2>
          <button
            className="text-[orange] text-[2vw] hover:scale-[1.1] ease-in-ease-out duration-300"
            onClick={() => {
              if (twitter?.user && account?.address) {
                setState(2)
              }
              account?.address && setState(1)
            }}
          >
            Enter Raffle
          </button>
          <p>Connect your wallet</p>
        </MainCard>
      </div>
    )
  }

  if (state === 1) {
    return (
      <div className="animate-fadeIn">
        <MainCard>
          <h2>Step 1: Verify your Twitter display name</h2>
          <button
            className="text-[cyan] text-[2vw] hover:scale-[1.1] ease-in-ease-out duration-300"
            onClick={async () => {
              await signIn()
            }}
          >
            Verify Twitter
          </button>
          <button onClick={() => setState(0)}>Cancel ✖</button>
        </MainCard>
      </div>
    )
  }

  const devUrl =
    'https://discord.com/api/oauth2/authorize?client_id=1068591529620418610&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fraffle&response_type=code&scope=identify%20email'

  const productionUrl =
    'https://discord.com/api/oauth2/authorize?client_id=1068591529620418610&redirect_uri=https%3A%2F%2Fapp.moondao.com%2Fraffle&response_type=code&scope=identify%20email'

  if (state === 2) {
    return (
      <div>
        <MainCard>
          <h2>Step 2: Verify your Discord username and email </h2>
          <button className="text-[purple] text-[2vw] hover:scale-[1.1] ease-in-ease-out duration-300">
            <Link href={devUrl}>Verify Discord</Link>
          </button>
          <button onClick={async () => await signOut()}>Cancel ✖</button>
        </MainCard>
      </div>
    )
  }

  if (state === 3) {
    return (
      <div>
        <MainCard>
          <h2>Step 3: Review and submit form</h2>
          <form className="flex flex-col justify-center items-center">
            <label>
              Twitter Display Name:
              <input
                className="flex flex-col text-black"
                type="text"
                readOnly
                value={twitter?.user?.name}
              />
            </label>
            <label>
              Discord Username:
              <input
                className="flex flex-col text-black"
                type="text"
                readOnly
                value={userDiscordData.username}
              />
            </label>
            <label>
              Wallet Address:
              <input
                className="flex flex-col text-black"
                type="text"
                readOnly
                value={account?.address}
              />
            </label>
            <label>
              Discord Email:
              <input
                className="flex flex-col text-black"
                type="text"
                readOnly
                value={userDiscordData.email}
              />
            </label>
            <button
              className="m-6 text-[lightgreen]"
              onClick={async (e) => {
                e.preventDefault()
                await submitRaffleForm({
                  twitterName: twitter?.user?.name,
                  discordName: userDiscordData.username,
                  walletAddress: account.address,
                  email: userDiscordData.email,
                })
                await signOut()
              }}
            >
              Submit ✔
            </button>
          </form>
          <button
            className="text-[coral]"
            onClick={async () => await signOut()}
          >
            Cancel ✖
          </button>
        </MainCard>
      </div>
    )
  }
}

export async function getServerSideProps(context: any) {
  const code = context?.query?.code
  console.log(code)
  let userDiscordData = {}
  if (code) userDiscordData = await getUserDiscordData(code)
  console.log(userDiscordData)
  return {
    props: {
      userDiscordData,
    },
  }
}
