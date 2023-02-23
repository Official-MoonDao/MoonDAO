import { useRouter } from 'next/router'
import MainCard from '../../components/layout/MainCard'

export default function ZeroGDetail() {
  const router = useRouter()
  return (
    <div className="flex flex-col justify-center items-center">
      <h1 className="font-GoodTimes text-3xl mb-8">Zero G Raffle Details</h1>
      <MainCard>
        <p className="font-RobotoMono text-2xl">June 9th | JSC, Houston, TX </p>
        <hr className="my-2"></hr>
        <p className="font-RobotoMono text-2xl">Book your ZeroG flight now! </p>
        <button
          className="text-n3green hover:scale-[1.05] ease-in duration-150"
          onClick={() => router.push('/zero-g')}
        >
          {'👈 Back'}
        </button>
      </MainCard>
    </div>
  )
}
