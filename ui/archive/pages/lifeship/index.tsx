import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { getKits } from '../../lib/shopify/lifeship-shopify'
import Head from '../../components/layout/Head'
import Product from '../../components/shopify/Product'
import flag from '../../public/Original.png'

function Button({ children, onClick, className = '' }: any) {
  return (
    <button
      className={`${className} mt-4 py-3 text-white bg-moon-orange font-RobotoMono w-full duration-[0.6s] ease-in-ease-out text-1xl`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function Lifeship({ products = [] }: any) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address
  //stages
  const [state, setState] = useState(0)

  //user-feedback
  const [notification, setNotification]: any = useState('')

  const [quantities, setQuantities] = useState({ dna: 0, ashes: 0, pet: 0 })

  function reset() {
    setState(0)
    setQuantities({ dna: 0, ashes: 0, pet: 0 })
    setNotification('')
  }

  useEffect(() => {
    if (router && router.query.state === '1') setState(1)
  }, [state, router])

  return (
    <main className="animate-fadeIn">
      <Head title="LifeShip" />

      <div className="mt-3 lg:mt-10 px-5 lg:px-10 xl:px-10 py-10 w-[336px] sm:w-[400px] lg:w-full lg:max-w-[1080px] page-border-and-color text-gray-900 dark:text-white">
        {/*Title */}
        <div className="flex flex-col lg:flex-row lg:gap-4 items-center text-center lg:text-left title-text-colors">
          <h2
            className={`mt-3 flex items-center gap-3 font-GoodTimes text-2xl xl:text-4xl 2xl:text-[40px] `}
          >
            MoonDAO
            <Image src={flag} width={50} height={50} alt="" />
          </h2>
          <h1 className=" text-moon-orange text-2xl font-semibold font-GoodTimes pt-[4%] lg:pt-4 xl:text-4xl 2xl:text-[40px]">
            {'  x  '}
          </h1>
          <h2
            className={`mt-3 flex items-center gap-3 font-GoodTimes text-2xl xl:text-4xl 2xl:text-[40px]`}
          >
            {'LifeShip'}
            <Image
              src={'/LifeShip_Main.png'}
              width={45}
              height={45}
              alt="Lifeship Logo"
              className="hidden dark:block"
            />
            <Image
              src={'/LifeShip_Main_Black.png'}
              width={45}
              height={45}
              alt="Lifeship Logo"
              className="dark:hidden"
            />
          </h2>
        </div>

        {state === 0 && (
          <div className="mt-5 lg:mt-8 flex flex-col justify-center items-center text-left gap-4 md:w-full w-full">
            {/*Paragraph text */}
            <p className="max-w-2xl lg:max-w-3xl font-RobotoMono lg:text-left lg:text-lg lg:self-start font-[Lato]">
              {`Send DNA or ashes to the moon, leaving your legacy in the universe! MoonDAO is partnering with`}{' '}
              <span>
                <button
                  className="text-moon-orange hover:scale-[1.025] ease-in-ease-out duration-300"
                  onClick={() => window.open('https://lifeship.com/')}
                >
                  {'LifeShip'}
                </button>
              </span>{' '}
              {`to send a time capsule of life on Earth to the Moon!`}
            </p>

            {/*Products*/}

            {products[0] && (
              <div className="flex flex-col gap-[5%] w-full items-center justify-center mt-3 lg:mt-8">
                <div className="w-full lg:min-h-[35vh] h-full flex flex-col lg:flex-row gap-2 xl:gap-4">
                  <Product
                    product={products[0]}
                    label="DNA Kit"
                    quantity={quantities.dna}
                    setQuantity={(q: number) =>
                      setQuantities({ ...quantities, dna: q })
                    }
                  />
                  <Product
                    product={products[1]}
                    label="Pet DNA Kit"
                    quantity={quantities.pet}
                    setQuantity={(q: number) =>
                      setQuantities({ ...quantities, pet: q })
                    }
                  />
                  {/* <Product
                    product={products[2]}
                    label="Ashes Kit"
                    quantity={quantities.ashes}
                    setQuantity={(q: number) =>
                      setQuantities({ ...quantities, ashes: q })
                    }
                  /> */}
                </div>
                {notification === 'no-quantity' && (
                  <p className="text-moon-orange ease-in duration-300 backdropBlur">
                    Please select a kit!
                  </p>
                )}
                <Button
                  className=""
                  onClick={async () => {
                    if (
                      quantities.dna <= 0 &&
                      quantities.ashes <= 0 &&
                      quantities.pet <= 0
                    )
                      return setNotification('no-quantity')
                    try {
                      await fetch('/api/shopify/lifeship/checkout', {
                        method: 'POST',
                        body: JSON.stringify({
                          quantityDNA: quantities.dna,
                          quantityAshes: quantities.ashes,
                          quantityPet: quantities.pet,
                          walletAddress: address,
                        }),
                      })
                        .then((res) => res.json())
                        .then((data) => {
                          window.open(data.checkoutURL)
                          reset()
                        })
                    } catch {
                      console.error('Problem submitting shopify checkout')
                    }
                  }}
                >
                  Checkout
                </Button>

                {/*Section after products*/}
                <div className="w-full flex">
                  <Product
                    product={products[3]}
                    label="NFT kit"
                    linkToStore={() => window.open(products[3].onlineStoreUrl)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

export async function getStaticProps() {
  try {
    const products = await getKits()

    return {
      props: {
        products: products || {},
      },
    }
  } catch (error) {
    console.error('Problem fetching lifeship products', error)
    return {
      props: { products: [] },
    }
  }
}
