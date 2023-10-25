import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from '../../components/layout/Head'
import {
  collectionMetadata,
  nft,
} from '../../components/marketplace/assets/seed'
import PurchasePortal from '../../components/zero-g/PurchasePortal'

export default function Ticket2Space() {
  const router = useRouter()
  //stages
  const [state, setState] = useState(0)
  const [time, setTime] = useState<string>()

  useEffect(() => {
    setTime(
      new Date().toLocaleDateString() + ' @ ' + new Date().toLocaleTimeString()
    )
  }, [])

  useEffect(() => {
    if (router && router.query.state === '1') setState(1)
  }, [state, router])

  return (
    <main className="animate-fadeIn">
      <Head title="Ticket" />

      <div className="mt-3 px-5 lg:px-10 xl:px-10 py-12 xl:pt-16 component-background w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] border-detail-light dark:border-detail-dark border lg:border-2 shadow-md shadow-detail-light dark:shadow-detail-dark xl:flex xl:flex-col xl:items-center">
        <div className="flex flex-col lg:flex-row lg:gap-4 justify-center items-center">
          <h1
            className={`font-GoodTimes tracking-wide leading-relaxed text-center text-2xl xl:text-4xl font-semibold mb-2 text-title-light dark:text-title-dark`}
          >
            Ticket to Space
          </h1>
        </div>
        <h3 className="mt-5 lg:mt-8 text-moon-blue dark:text-detail-dark font-RobotoMono text-xl lg:text-2xl text-center">
          Take the leap, for the chance to win a trip to space!
        </h3>
        {state === 0 && (
          <div className="mt-5 lg:mt-8 flex flex-col justify-center items-center text-left gap-4 md:w-full w-full backdropBlurp-4 text-light-text dark:text-dark-text">
            <p className="max-w-2xl lg:max-w-3xl font-RobotoMono text-center lg:text-lg">
              Purchase this NFT and follow us on our journey to randomly select
              an owner to win a trip to space!
            </p>
            <div className="my-8 xl:mt-5 w-full flex justify-center">
              <div className="flex justify-center h-[2px] bg-gradient-to-r from-detail-light to-moon-blue dark:from-detail-dark dark:to-moon-gold lg:mt-7 lg:h-[3px] w-5/6"></div>
            </div>
          </div>
        )}
        <div className="w-full flex flex-col gap-8 tablet:flex-row pb-32 tablet:pb-0">
          {/*Collection title, image and description*/}
          <div className="relative w-full max-w-full top-0 tablet:flex-shrink tablet:sticky tablet:min-w-[370px] tablet:max-w-[450px] tablet:mt-4 tablet:mr-4">
            {collectionMetadata && (
              <div className="flex items-center mb-2 gap-12">
                <Image
                  src="/Original.png"
                  width={400}
                  height={400}
                  alt="Picture of the author"
                />
                <div className="flex flex-col w-full relative grow bg-transparent rounded-2xl overflow-hidden">
                  <h1 className="font-GoodTimes font-medium text-[32px] break-words mb-2 mx-4 text-moon-white">
                    {nft.metadata.name}
                  </h1>
                  <div className="p-4 pl-5 rounded-xl bg-white bg-opacity-[0.13] w-full m-0 mb-3">
                    {/* Quantity for ERC1155 */}
                    {nft.type === 'ERC1155' && (
                      <>
                        <p className="text-white opacity-60 mt-1 p-[2px]">
                          Quantity left
                        </p>
                        <div className="text-[18px] leading-6 font-semibold text-white text-opacity-90 m-0 rounded-lg">
                          {198}
                        </div>
                      </>
                    )}
                    {/* Pricing information */}
                    <p className="text-white opacity-60 mt-1 p-[2px]">Price</p>
                    <div className="text-[18px] leading-6 font-semibold text-white text-opacity-90 m-0 rounded-lg">
                      <div>
                        100 MOONEY
                        <p
                          className="text-white opacity-60 mt-1 p-[2px]"
                          style={{ marginTop: 12 }}
                        >
                          {'Expiration'}
                        </p>
                        <div className="text-[18px] leading-6 font-semibold text-white text-opacity-90 m-0 rounded-lg">
                          {time}
                        </div>
                      </div>
                    </div>
                  </div>
                  <PurchasePortal></PurchasePortal>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
