import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { hasUserSubmittedNFT, uploadFile } from '../../lib/firebase'
import { getProductByHandle } from '../../lib/lifeship-shopify'
import { useAccount } from '../../lib/use-wagmi'
import GradientLink from '../../components/layout/GradientLink'
import Head from '../../components/layout/Head'
import MainCard from '../../components/layout/MainCard'
import flag from '../../public/Original.png'
import { Scene } from '../../r3f/Moon/Scene'

/* STAGES
0. START
1. SUBMIT IMAGE
2. CHECKOUT
3. USER ALREADY HAS NFT

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
    <div className="flex flex-col justify-center items-center gap-4">
      {children}
    </div>
  )
}

export default function Lifeship({ product = {} }: any) {
  const router = useRouter()
  const { data: account } = useAccount()
  //stages
  const [state, setState] = useState(0)

  //user-feedback
  const [notification, setNotification] = useState('')

  //NFT submission
  const [userImage, setUserImage]: any = useState({})

  //# of kits
  const [quantity, setQuantity] = useState(0)

  //current preview image
  const [preview, setPreview] = useState(0)

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

  useEffect(() => {
    if (router && router.query.state === '1') setState(1)
    if (account?.address) {
      //check if current wallet address has already submitted a NFT
      ;(async () => {
        const res = await hasUserSubmittedNFT(account?.address)
        setUserSubmittedNFT(res)
      })()

      console.log(userSubmittedNFT, userImage)
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
                : 'Send your DNA to the Moon!'
            }
            className="w-full"
          >
            <div className="flex flex-col items-center gap-4">
              {state === 0 && (
                <div className="flex flex-col gap-4">
                  <p className="max-w-2xl font-RobotoMono">
                    {
                      'You are invited to participate in a historic decentralized space program. Choose your digital file to launch on a lunar lander with NFT ownership through Lifeship. '
                    }
                  </p>
                  <p className="max-w-2xl font-RobotoMono">
                    {
                      'Connect with an international community dedicated to a permanent settlement on the Moon and learn about participating in Astronaut and Zero G Flights!'
                    }
                  </p>
                  <Button
                    onClick={() => {
                      if (userSubmittedNFT) {
                        setState(3)
                      } else setState(1)
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
                      'Send a NFT to Space! Submit a file, after you have purchased your kit your image will be tranformed, sent to the Moon and then airdropped to you! Please connect your wallet.'
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
                      if (userSubmittedNFT)
                        return setNotification('user-already-submitted')
                      else {
                        await uploadFile(userImage, account?.address)
                        setState(2)
                      }
                    }}
                  >
                    Submit Image
                  </Button>
                  <Button
                    className="w-2/3 mt-4 p-1"
                    onClick={() => {
                      setState(2)
                    }}
                  >
                    {'Skip (opt out of NFT submission)'}
                  </Button>
                </StageContainer>
              )}
              {state === 2 && (
                <StageContainer>
                  {!account && notification === 'no-wallet' && (
                    <p className="text-n3green ease-in duration-300">
                      Please connect your wallet to proceed
                    </p>
                  )}
                  <Image
                    className="rounded-2xl backdropBlur"
                    src={product.images[preview].src}
                    width={400}
                    height={320}
                  />
                  <div className="flex justify-center items-center gap-[22%] w-1/2">
                    <button
                      className={`border-style btn text-n3blue normal-case font-medium w-1/2 bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out ${
                        preview === 0 && 'disabled opacity-[0.5]'
                      }`}
                      onClick={() =>
                        preview > 0 ? setPreview(preview - 1) : ''
                      }
                    >
                      {'<'}
                    </button>
                    <div className="flex justify-center items-center">
                      {product.images.map((image: any, i: number) => (
                        <button
                          key={'pagination' + i}
                          className={`${
                            preview === i && 'text-n3blue'
                          } text-3xl hover:scale-[1.025]`}
                          onClick={() => setPreview(i)}
                        >
                          .
                        </button>
                      ))}
                    </div>
                    <button
                      className={`border-style btn text-n3blue normal-case font-medium w-1/2 bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out ${
                        preview === product.images.length - 1 &&
                        'disabled opacity-[0.5]'
                      }`}
                      onClick={() =>
                        preview < product.images.length - 1
                          ? setPreview(preview + 1)
                          : ''
                      }
                    >
                      {'>'}
                    </button>
                  </div>

                  <hr className="w-full border-n3blue"></hr>
                  <div className="w-full flex flex-col justify-center items-center gap-4 ">
                    <div className="flex gap-2 justify-center">
                      <p className="text-3xl text-n3blue">Quantity:</p>
                      <p className="text-3xl">{quantity}</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <p className="text-3xl text-n3blue">Total:</p>
                      <p className="text-3xl">{`$${(
                        product.variants[0].price.amount * quantity
                      ).toFixed(2)}`}</p>
                    </div>
                    <div className="my-2 flex justify-center items-center gap-8 w-full">
                      <button
                        className={`border-style btn text-n3blue normal-case font-medium w-1/4 bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out ${
                          quantity <= 0 && 'disable opacity-[0.5]'
                        }`}
                        onClick={() =>
                          setQuantity(quantity > 0 ? quantity - 1 : 0)
                        }
                      >
                        -
                      </button>
                      <button
                        className="border-style btn text-n3blue normal-case font-medium w-1/4 bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <hr className="w-full border-n3blue"></hr>
                  </div>

                  <button
                    className={` border-style btn text-n3blue normal-case font-medium w-full my-4 bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out ${
                      quantity === 0 && 'disabled opacity-[0]'
                    }`}
                    onClick={async () => {
                      try {
                        if (quantity <= 0) return
                        const checkoutURL: any = await fetch(
                          '/api/shopify/lifeship/dna-to-moon',
                          {
                            method: 'POST',
                            body: JSON.stringify({
                              quantity: quantity,
                              walletAddress: account?.address,
                            }),
                          }
                        )
                          .then((res) => res.json())
                          .then((data) => window.open(data.checkoutURL))
                      } catch {
                        console.error('Problem submitting shopify checkout')
                      }
                    }}
                  >
                    Checkout
                  </button>
                  <Cancel />
                </StageContainer>
              )}
              {state === 3 && (
                <MainCard title="Welcome back!">
                  <p className="text-2xl text-n3blue">{`Looks like you've already submitted an image, please purchase a Lifeship DNA Kit to make your image into a NFT and send it to the Moon!`}</p>
                  <button
                    className="border-style btn text-n3blue normal-case font-medium w-full bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out"
                    onClick={() => setState(2)}
                  >
                    continue
                  </button>
                </MainCard>
              )}
            </div>
          </MainCard>
        </div>
      </div>
    </div>
  )
}

// export async function getStaticProps({ params }: any) {
//   const product = await getProductByHandle('dna-to-moon')

//   return {
//     props: {
//       product: product || {},
//     },
//   }
// }
