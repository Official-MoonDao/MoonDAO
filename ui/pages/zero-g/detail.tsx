import { useRouter } from 'next/router'
import MainCard from '../../components/layout/MainCard'

export default function ZeroGDetail() {
  const router = useRouter()
  return (
    <MainCard title="Zero-G Flight Details">
      <MainCard>
        <p className="text-2xl">June 9th | JSC, Houston, TX </p>
        <hr className="my-2"></hr>
        <p className="text-2xl">Book your Zero-G flight now! </p>
        <button
          className="text-n3green hover:scale-[1.05] ease-in duration-150"
          onClick={() => router.push('/zero-g')}
        >
          {'👈 Back'}
        </button>
      </MainCard>
    </MainCard>
  )
}
