import { useSession, signIn, signOut } from 'next-auth/react'
import { useState } from 'react'
import { submitRaffleForm } from '../lib/submit-raffle-form'
import MainCard from '../components/MainCard'

function RaffleForm() {
  const { data: session } = useSession()

  const [form, setForm] = useState({
    twitterName: '',
    discordName: '',
    walletAddress: '',
    email: '',
  })

  function handleInputChange(e: any) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }
  if (session)
    return (
      <div>
        <p>Twitter : {session.user?.name}</p>
        <p>signed in</p>
        <button onClick={() => signOut()}>Sign Out</button>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            await submitRaffleForm(form)
          }}
        >
          <input
            name="twitterName"
            type="text"
            onChange={handleInputChange}
            placeholder="twitter display name"
          />
          <input
            name="discordName"
            type="text"
            onChange={handleInputChange}
            placeholder="disocrd username"
          />
          <input
            name="walletAddress"
            type="text"
            onChange={handleInputChange}
            placeholder="wallet addrress"
          />
          <input
            name="email"
            type="email"
            onChange={handleInputChange}
            placeholder="email"
          />
          <button>submit</button>
        </form>
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
        <RaffleForm />
      </MainCard>
    </div>
  )
}
