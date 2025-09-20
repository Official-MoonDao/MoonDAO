// apps/web/pages/play.tsx
import { SignJWT } from 'jose'

export async function getServerSideProps() {
  const token = await new SignJWT({
    sub: 'user-id',
    wallet: '0x...',
    name: 'name.get',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!))
  return { props: { token } }
}

export default function Space({ token }: { token: string }) {
  return (
    <iframe
      src={`/game/index.html#token=${encodeURIComponent(token)}`}
      style={{ width: '100%', height: '100vh', border: 0 }}
    />
  )
}
