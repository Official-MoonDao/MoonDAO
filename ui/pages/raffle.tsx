import { useSession, signIn, signOut } from 'next-auth/react'
import MainCard from '../components/MainCard'

function TwitterLogin() {
  const { data: session } = useSession()
  console.log('Session:', session)
  console.log('User:', session?.user)
  if (session)
    return (
      <div>
        <p>signed in</p>
        <button onClick={() => signOut()}>Sign Out</button>
      </div>
    )
  return (
    <div>
      <p>not signed in</p>
      <button onClick={() => signIn()}>Sign In</button>
    </div>
  )
}

export default function Raffle() {
  return (
    <div>
      <MainCard>
        <TwitterLogin />
      </MainCard>
    </div>
  )
}
