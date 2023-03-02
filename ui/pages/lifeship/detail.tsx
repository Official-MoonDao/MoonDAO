import { useRouter } from 'next/router'
import MainCard from '../../components/layout/MainCard'

export default function LifeshipNFTDetail() {
  const router = useRouter()
  return (
    <div className="animate-fadeIn">
      <MainCard title="Lifeship NFT Details">
        <p>{`MoonDAO is partnering with lifeship to send NFTs to space! Please upload a file and complete the checkout. You will be emailed instrucitons to claim your NFT.`}</p>
        <button
          className="text-n3blue hover:scale-[1.05] ease-in duration-150"
          onClick={() => router.push('/lifeship')}
        >
          {'👈 Back'}
        </button>
      </MainCard>
    </div>
  )
}
