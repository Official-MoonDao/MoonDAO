import { useRouter } from 'next/router'
import WebsiteHead from '../../components/layout/Head'
import MainCard from '../../components/layout/MainCard'

export default function LifeshipNFTDetail() {
  const router = useRouter()
  return (
    <div className="animate-fadeIn">
      <WebsiteHead title="Lifeship NFT Details" />
      <MainCard title="Lifeship NFT Details">
        <p>{`MoonDAO is partnering with lifeship to send NFTs to space! Please upload a file and complete the checkout. You will be emailed instrucitons to claim your NFT.`}</p>
        <div className="w-full flex justify-center">
          <button
            className="mt-4 flex items-center bg-[grey] text-lg rounded px-2 py-1 text-gray-100 hover:scale-[1.05] hover:text-white hover:bg-n3blue ease-in duration-150 w-1/4"
            onClick={() => router.push('/zero-g')}
          >
            {'← Back'}
          </button>
        </div>
      </MainCard>
    </div>
  )
}
