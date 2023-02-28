import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { hasUserSubmittedNFT, uploadFile } from '../../lib/firebase'
import { getKits, getProductByHandle } from '../../lib/lifeship-shopify'
import { useAccount } from '../../lib/use-wagmi'
import GradientLink from '../../components/layout/GradientLink'
import Head from '../../components/layout/Head'
import MainCard from '../../components/layout/MainCard'
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

export default function Lifeship({ products = [] }) {
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
      <div className="flex flex-col max-w-3xl">
        <div className="grid xl:grid-cols-1 mt-2 gap-8">
          <div className="flex flex-col md:flex-row items-center md:gap-4 justify-center ">
            <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
              {'MoonDAO'}
              <Image src={flag} width={36} height={36} />
            </h1>
            <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
              {'  +  '}
            </h1>
            <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
              {'LifeShip'}
              <Image src={'/LifeShip_Main.png'} width={36} height={36} />
            </h1>
          </div>
          <MainCard
            title={
              state === 0
                ? 'Join us on our first mission to the Moon!'
                : state === 1
                ? 'Send an image to the Moon!'
                : ''
            }
            className="w-full"
          >
            <div className="flex flex-col items-center gap-4">
              {state === 0 && (
                <div className="flex flex-col gap-4">
                  <p className="max-w-2xl font-RobotoMono">
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
                  {notification === 'no-quantity' && (
                    <p className="text-n3green ease-in duration-300">
                      Please select a kit!
                    </p>
                  )}
                  {products[0] && (
                    <div className="flex flex-col gap-8 w-full">
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
                  <Button
                    onClick={async () => {
                      if (quantities.dna <= 0 && quantities.ashes <= 0)
                        return setNotification('no-quantity')
                      if (userSubmittedNFT) {
                        setState(3)
                        try {
                          if (quantities.dna <= 0 && quantities.ashes <= 0)
                            return setNotification('no-quantity')
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
                              setTimeout(() => {
                                window.open(data.checkoutURL)
                                reset()
                              }, 3000)
                            })
                        } catch {
                          console.error('Problem submitting shopify checkout')
                        }
                      } else {
                        setNotification('')
                        setState(1)
                      }
                    }}
                  >
                    Continue
                  </Button>
                </div>
              )}
              {state === 1 && (
                <StageContainer>
                  <p className="mb-2 max-w-2xl font-RobotoMono">
                    {
                      'Send a NFT to Space! Submit a file, after you have purchased your kit your image will be transformed, sent to the Moon and then airdropped to you! Please connect your wallet.'
                    }
                  </p>
                  <GradientLink
                    text={'NFT Submission Details'}
                    href="/lifeship/detail"
                    internal={false}
                    textSize={'md'}
                  ></GradientLink>
                  {notification === 'invalid-file-format' && (
                    <p className="text-n3green ease-in duration-300">
                      Invalid file format, please only upload images 😄
                    </p>
                  )}
                  {notification === 'no-file' && (
                    <p className="text-n3green ease-in duration-300">
                      Please choose a file
                    </p>
                  )}
                  {notification === 'no-wallet' && (
                    <p className="text-n3green ease-in duration-300">
                      Please connect your wallet to proceed
                    </p>
                  )}
                  {notification === 'user-already-submitted' && (
                    <p className="text-n3green ease-in duration-300">
                      {"You've already submitted a NFT!"}
                    </p>
                  )}
                  {notification === 'no-quantity' && (
                    <p className="text-n3green ease-in duration-300">
                      {'Please select a kit'}
                    </p>
                  )}
                  <input
                    className="pt-[2.5%] border-style btn text-n3blue normal-case font-medium w-full bg-transparent"
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e: any) => {
                      setNotification('')
                      if (e.target.files[0]) setUserImage(e.target.files[0])
                    }}
                  />
                  <Button
                    onClick={async () => {
                      if (!userImage.type) return setNotification('no-file')
                      if (!userImage.type.startsWith('image'))
                        return setNotification('invalid-file-format')
                      if (!account) return setNotification('no-wallet')
                      if (quantities.dna <= 0 && quantities.ashes <= 0)
                        return setNotification('no-quantity')
                      if (userSubmittedNFT) {
                        setState(3)
                      } else {
                        await uploadFile(userImage, account?.address)
                        setState(2)
                      }
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
                            setTimeout(() => {
                              window.open(data.checkoutURL)
                              reset()
                            }, 3000)
                          })
                      } catch {
                        console.error('Problem submitting shopify checkout')
                      }
                    }}
                  >
                    Submit Image
                  </Button>
                  <Button
                    className="w-2/3 mt-4 p-1"
                    onClick={async () => {
                      try {
                        if (quantities.dna <= 0 && quantities.ashes <= 0)
                          return setNotification('no-quantity')
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
                    {'Skip (opt out of NFT submission)'}
                  </Button>
                </StageContainer>
              )}
              {state === 2 && (
                <StageContainer>
                  <p className="text-2xl text-n3blue">{`Your Image was successfully uploaded!`}</p>
                </StageContainer>
              )}
              {state === 3 && (
                <MainCard title="Welcome back!">
                  <p className="text-2xl text-n3blue">{`Looks like you've already submitted an image!`}</p>
                </MainCard>
              )}
            </div>
          </MainCard>
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
