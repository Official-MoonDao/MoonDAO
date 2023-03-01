import { useRouter } from 'next/router'
import MainCard from '../../components/layout/MainCard'

export default function LifeshipNFTDetail() {
  const router = useRouter()
  return (
    <div className="animate-fadeIn">
      <MainCard title="Lifeship NFT Details">
        <p>{`MoonDAO is partnering with lifeship to send NFTs to space! In order to send a NFT to space you must also purchase a DNA kit. Upload an image or video.  Your NFT will be sent to the wallet you have connected to the site.`}</p>
        <button
          className="text-n3green hover:scale-[1.05] ease-in duration-150"
          onClick={() => router.push('/lifeship')}
        >
          {'👈 Back'}
        </button>
      </MainCard>
    </div>
  )
}
