import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { hasUserSubmittedNFT } from '../../lib/firebase'
import { getKits } from '../../lib/lifeship-shopify'
import { useAccount } from '../../lib/use-wagmi'
import GradientLink from '../../components/layout/GradientLink'
import Head from '../../components/layout/Head'
import Product from '../../components/shopify/Product'
import flag from '../../public/Original.png'
import { Scene } from '../../r3f/Moon/Scene'

/* STAGES
0. SELECT KITS
1. UPLOAD IMAGE
2. UPLOAD IMAGE SUCCESS
3. USER ALREADY UPLOADED IMAGE
*/

function Button({ children, onClick, className = '' }: any) {
  return (
    <button
      className={`${className} my-2 border-style btn text-n3blue normal-case font-medium w-full  bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function StageContainer({ children }: any) {
  return (
    <div className="flex flex-col justify-center items-center gap-4 w-full">
      {children}
    </div>
  )
}

export default function Lifeship({ products = [] }: any) {
  const router = useRouter()
  const { data: account } = useAccount()
  //stages
  const [state, setState] = useState(0)

  //user-feedback
  const [notification, setNotification]: any = useState('')

  //NFT submission
  const [userImage, setUserImage]: any = useState({})

  const [quantities, setQuantities] = useState({ dna: 0, ashes: 0 })

  //check if user has already submited a NFT
  const [userSubmittedNFT, setUserSubmittedNFT]: any = useState(false)

  function Cancel() {
    return (
      <button
        className="border-n3green border-2 text-n3green hover:scale-[1.05] ease-in duration-150 w-1/3 rounded-2xl text-center py-2"
        onClick={() => setState(0)}
      >
        Cancel ✖
      </button>
    )
  }

  function reset() {
    setState(0)
    setQuantities({ dna: 0, ashes: 0 })
    setNotification('')
  }

  useEffect(() => {
    if (router && router.query.state === '1') setState(1)
    if (account?.address) {
      //check if current wallet address has already submitted a NFT
      ;(async () => {
        const res = await hasUserSubmittedNFT(account?.address)
        setUserSubmittedNFT(res)
      })()
    }
  }, [state, account, router])

  return (
    <div className="animate-fadeIn">
      <Scene zoomEnabled />
      <Head title="Lifeship" />
      <div className="flex flex-col max-w-3xl justify-center">
        <div className="flex flex-col justify-center items-center gap-4">
          <div className="flex flex-col justify-center items-center text-center md:w-[55vw] w-screen card rounded-[15px] border-[0.5px] border-gray-300 bg-black bg-opacity-30 shadow-indigo-40 text-white font-RobotoMono shadow-md overflow-visible p-[5%] relative right-4">
            <div className="flex flex-col md:flex-row md:gap-4 justify-center">
              <h2
                className={`mt-3 card-title text-center font-GoodTimes text-2xl lg:text-3xl font-medium text-transparent bg-clip-text bg-gradient-to-tr from-n3blue to-amber-200`}
              >
                MoonDAO
                <Image src={flag} width={50} height={50} />
              </h2>
              <h1 className="text-center text-n3blue text-2xl font-semibold font-GoodTimes pt-[4%]">
                {'  x  '}
              </h1>
              <h2
                className={`mt-3 card-title text-center font-GoodTimes text-2xl lg:text-3xl font-medium text-transparent bg-clip-text bg-gradient-to-tr from-n3blue to-amber-200`}
              >
                {'LifeShip'}
                <Image src={'/LifeShip_Main.png'} width={45} height={45} />
              </h2>
            </div>
            <h1 className="font-RobotoMono text-2xl text-center my-4">
              Join us on our first mission to the Moon!
            </h1>
            {state === 0 && (
              <div className="flex flex-col justify-center items-center text-left gap-4 md:w-full w-full backdropBlur p-4">
                <p className="font-RobotoMono">
                  {
                    'You are invited to participate in a historic decentralized space program. Choose your digital file to launch on a lunar lander with NFT ownership through '
                  }
                  <span>
                    <button
                      className="text-n3blue hover:scale-[1.025] ease-in-ease-out duration-300"
                      onClick={() => window.open('https://lifeship.com/')}
                    >
                      {'Lifeship'}
                    </button>
                  </span>
                </p>
                <p className="max-w-2xl font-RobotoMono">
                  {
                    'Connect with an international community dedicated to a permanent settlement on the Moon and learn about participating in Astronaut and Zero G Flights!'
                  }
                </p>
                <hr className="w-full border-n3blue border-2"></hr>

                {products[0] && (
                  <div className="flex flex-col gap-8 w-full">
                    <Product
                      product={products[2]}
                      label="NFT kit"
                      linkToStore={() =>
                        window.open(products[2].onlineStoreUrl)
                      }
                    />
                    <hr className="w-full border-n3blue border-2"></hr>
                    <Product
                      product={products[0]}
                      label="DNA kit"
                      quantity={quantities.dna}
                      setQuantity={(q: number) =>
                        setQuantities({ ...quantities, dna: q })
                      }
                    />
                    <Product
                      product={products[1]}
                      label="Ashes kit"
                      quantity={quantities.ashes}
                      setQuantity={(q: number) =>
                        setQuantities({ ...quantities, ashes: q })
                      }
                    />
                  </div>
                )}
                {notification === 'no-quantity' && (
                  <p className="text-n3green ease-in duration-300 backdropBlur">
                    Please select a kit!
                  </p>
                )}
                <Button
                  className="font-GoodTimes"
                  onClick={async () => {
                    if (quantities.dna <= 0 && quantities.ashes <= 0)
                      return setNotification('no-quantity')
                    try {
                      await fetch('/api/shopify/lifeship/checkout', {
                        method: 'POST',
                        body: JSON.stringify({
                          quantityDNA: quantities.dna,
                          quantityAshes: quantities.ashes,
                          walletAddress: account?.address,
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export async function getStaticProps({ params }: any) {
  const products = await getKits()

  return {
    props: {
      products: products || {},
    },
  }
}
