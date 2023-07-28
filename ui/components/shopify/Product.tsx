import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Product({
  product,
  label,
  quantity,
  setQuantity,
  linkToStore,
}: any) {
  const [preview, setPreview] = useState(0)

  useEffect(() => {
    setPreview(0)
  }, [product])

  if (linkToStore)
    return (
      <div className="prod backdropBlur flex justify-center items-center">
        <div className="flex flex-col m-2">
          <div className="flex gap-4 w-full my-2">
            <h2 className="font-GoodTimes">{label}</h2>
            <Link href="/lifeship/detail">
              <p
                className={`block text-md font-GoodTimes font-semibold bg-gradient-to-r from-n3blue  to-n3blue text-transparent bg-clip-text`}
              >
                NFT Submission Details →
              </p>
            </Link>
          </div>
          <div className="flex flex-col justify-center items-center">
            <Image
              id="product-image"
              className="rounded-2xl backdropBlur"
              src={product.images[preview]?.src}
              width={450}
              height={450}
              alt={`product-${preview}`}
            />
            <div className="flex justify-center items-center gap-4 w-1/2 my-2">
              <button
                className={`rounded-full bg-[#1c1c1c] w-8 h-8 text-white text-2xl backdropBlur hover:text-n3blue  duration-[0.6s] ease-in-ease-out`}
                onClick={() =>
                  preview > 0
                    ? setPreview(preview - 1)
                    : setPreview(product.images.length - 1)
                }
              >
                {'<'}
              </button>
              <div className="flex justify-center items-center mb-2 relative bottom-1">
                {product?.images[0] &&
                  product.images.map((image: any, i: number) => (
                    <button
                      key={'pagination' + i}
                      className={`${
                        preview === i && 'text-n3blue'
                      } text-3xl hover:scale-[1.15]`}
                      onClick={() => setPreview(i)}
                    >
                      .
                    </button>
                  ))}
              </div>
              <button
                className={`rounded-full bg-[#1c1c1c] w-8 h-8 text-white text-2xl backdropBlur hover:text-n3blue  duration-[0.6s] ease-in-ease-out`}
                onClick={() => {
                  if (!product?.images) return
                  preview < product.images.length - 1
                    ? setPreview(preview + 1)
                    : setPreview(0)
                }}
              >
                {'>'}
              </button>
            </div>
            <button
              id="link-to-store"
              className="font-GoodTimes border-style btn text-n3blue normal-case font-medium w-full bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out my-2"
              onClick={() => linkToStore()}
            >
              Send a File to Space!
            </button>
          </div>
        </div>
      </div>
    )

  return (
    <div className="w-full md:max-w-1/3 bg-[#1c1c1c80] rounded-lg backdropBlur flex flex-col justify-center items-center p-4 pb-[2.5%]">
      <div className="flex flex-col">
        <h2 className="w-full mt-4 font-GoodTimes mx-4">{label}</h2>
        <div className="p-2">
          {product?.images[preview] && (
            <Image
              id="product-image"
              className={`rounded-2xl backdropBlur`}
              src={product.images[preview]?.src}
              width={450}
              height={400}
              alt={`product-${preview}`}
            />
          )}
        </div>

        <div className="w-full flex justify-center items-center">
          <button
            className={`rounded-full bg-[#1c1c1c] w-8 h-8 text-white text-2xl backdropBlur hover:text-n3blue duration-[0.6s] ease-in-ease-out`}
            onClick={() =>
              preview > 0
                ? setPreview(preview - 1)
                : setPreview(product.images.length - 1)
            }
          >
            {'<'}
          </button>
          <div className="flex justify-center items-center relative bottom-1.5 ">
            {product?.images[0] &&
              product.images.map((image: any, i: number) => (
                <button
                  key={'pagination' + i}
                  className={`${
                    preview === i && 'text-n3blue'
                  } text-[150%] hover:scale-[1.25]`}
                  onClick={() => setPreview(i)}
                >
                  .
                </button>
              ))}
          </div>
          <button
            className={`rounded-full bg-[#1c1c1c] w-8 h-8 text-white text-2xl backdropBlur hover:text-n3blue  duration-[0.6s] ease-in-ease-out`}
            onClick={() => {
              if (!product?.images) return
              preview < product.images.length - 1
                ? setPreview(preview + 1)
                : setPreview(0)
            }}
          >
            {'>'}
          </button>
        </div>
      </div>
      <div className="flex flex-col justify-center items-center max-w-3/4">
        <div className="flex justify-center items-center w-full">
          <button
            className={`absolute left-[4%] border-style h-10 w-10 md:h-[3vw] md:w-[3vw] md:max-w-[75px] md:max-h-[75px] text-n3blue normal-case font-medium bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out rounded-full ${
              quantity <= 0 && 'disable opacity-[0.5]'
            }`}
            onClick={() => setQuantity(quantity > 0 ? quantity - 1 : 0)}
          >
            -
          </button>
          <div className="flex flex-col items-left justify-center">
            <div className="w-full">
              <p className="text-[100%] text-n3blue">
                {'Quantity:'}
                <span className="text-white">{quantity}</span>
              </p>
            </div>
            <div className="w-full">
              <p className="text-[85%] text-n3blue">
                {'Total:'}
                <span className="text-white ">{`$${
                  product?.variants
                    ? (product.variants[0].price.amount * quantity).toFixed(2)
                    : 0
                }`}</span>
              </p>
            </div>
          </div>
          <button
            className="absolute right-[4%] border-style h-10 w-10 md:h-[3vw] md:w-[3vw] md:max-w-[75px] md:max-h-[75px] text-n3blue normal-case font-medium bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out rounded-full"
            onClick={() => setQuantity(quantity + 1)}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
