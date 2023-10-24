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

  //This return is the link to the store.
  if (linkToStore)
    return (
      <div className="mt-8 flex justify-center items-center">
        <div className="flex flex-col m-2">
          <div className="flex flex-col items-center justify-center my-3 text-center">
            <h3 className="text-white font-GoodTimes text-center text-4xl lg:text-left leading-relaxed w-full">
              Lifeship NFT
            </h3>
            <p className="lg:w-3/4 mt-2 md:mt-4 text-sm font-mono leading-relaxed lg:text-base lg:text-left lg:self-start xl:text-lg text-white opacity-90">
              MoonDAO is partnering with lifeship to send NFTs to space! Please
              upload a file and complete the checkout. You will be emailed
              instrucitons to claim your NFT.
            </p>
          </div>
          {/*NFT kit */}
          <div className="p-5 flex flex-col justify-center items-center bg-[#071732] lg:max-w-[700px]">
            <h3 className="text-white font-GoodTimes text-center text-3xl lg:text-left leading-relaxed w-full">
              NFT KIT
            </h3>
            <Image
              id="product-image"
              className="mt-5 self-start rounded-2xl"
              src={product.images[preview]?.src}
              width={450}
              height={450}
              alt={`product-${preview}`}
            />
            <div className="flex justify-center items-center gap-4 my-2">
              <button
                className={`rounded-full bg-slate-800 w-8 h-8 text-white text-xl backdropBlur hover:text-n3blue duration-[0.6s] ease-in-ease-out`}
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
                      } text-4xl hover:scale-110 px-2`}
                      onClick={() => setPreview(i)}
                    >
                      .
                    </button>
                  ))}
              </div>
              <button
                className={`rounded-full bg-slate-800 w-8 h-8 text-white text-xl backdropBlur hover:text-n3blue duration-[0.6s] ease-in-ease-out`}
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
            {/*Final page button*/}
            <button
              id="link-to-store"
              className="mt-4 py-3 text-white bg-moon-orange font-RobotoMono w-full duration-[0.6s] ease-in-ease-out text-1xl"
              onClick={() => linkToStore()}
            >
              Send a File to Space!
            </button>
          </div>
        </div>
      </div>
    )

  //This return is the products.
  return (
    <div className="w-full relative lg:max-w-1/3 bg-gray-300 dark:bg-[#071732] rounded-lg flex flex-col justify-center items-center p-3 lg:p-1 font-RobotoMono">
      <div className="flex flex-col items-center lg:gap-5 xl:gap-2">
        <h2 className="w-full mt-4 mx-4 text-center xl:text-lg 2xl:mr-2 text-white font-semibold">
          {label}
        </h2>
        <div className="p-2">
          {product?.images[preview] && (
            <Image
              id="product-image"
              className={`rounded-2xl bg-gray-100 dark:bg-slate-800`}
              src={product.images[preview]?.src}
              width={250}
              height={400}
              alt={`product-${preview}`}
            />
          )}
        </div>

        {/*Product pagination*/}
        <div className="w-full flex justify-center items-center">
          <button
            className={`rounded-full bg-slate-800 w-8 h-8 lg:w-7 lg:h-7 2xl:w-8 2xl:h-8 text-white text-xl backdropBlur hover:text-n3blue duration-[0.6s] ease-in-ease-out`}
            onClick={() =>
              preview > 0
                ? setPreview(preview - 1)
                : setPreview(product.images.length - 1)
            }
          >
            {'<'}
          </button>
          <div className="flex items-center relative bottom-2">
            {product?.images[0] &&
              product.images.map((image: any, i: number) => (
                <button
                  key={'pagination' + i}
                  className={`${
                    preview === i && 'text-moon-orange'
                  } text-3xl hover:scale-110 px-1 2xl:px-2`}
                  onClick={() => setPreview(i)}
                >
                  .
                </button>
              ))}
          </div>
          <button
            className={`rounded-full bg-slate-800 w-8 h-8 lg:w-7 lg:h-7 2xl:w-8 2xl:h-8 text-white text-xl backdropBlur hover:text-moon-orange duration-[0.6s] ease-in-ease-out`}
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

      {/*Plus, Minus, quantity, total*/}
      <div className="mt-2 flex flex-col justify-center items-center max-w-3/4">
        <div className="flex justify-center items-center w-full">
          <button
            className={`absolute left-[3%]  h-9 w-9 lg:h-6 lg:w-6 2xl:h-8 2xl:w-8 border border-moon-orange text-moon-orange rounded-full ${
              quantity <= 0 && 'disable opacity-[0.5] pointer-events-none'
            }`}
            onClick={() => setQuantity(quantity > 0 ? quantity - 1 : 0)}
          >
            <span className="relative bottom-[2px] lg:bottom-1 2xl:bottom-[2px]">
              -
            </span>
          </button>
          {/*Quantity and total */}
          <div className="flex flex-col justify-center items-center gap-1">
            <div className="w-full">
              <p className="text-white text-sm">
                {'Quantity:'}
                <span className="ml-2 text-moon-orange">{quantity}</span>
              </p>
            </div>
            <div className="w-full">
              <p className=" text-white text-sm">
                {'Total:'}
                <span className="ml-2 text-moon-orange">{`$${
                  product?.variants
                    ? (product.variants[0].price.amount * quantity).toFixed(2)
                    : 0
                }`}</span>
              </p>
            </div>
          </div>
          <button
            className="absolute right-[3%] h-9 w-9 lg:h-6 lg:w-6 2xl:h-8 2xl:w-8 border border-moon-orange text-moon-orange rounded-full "
            onClick={() => setQuantity(quantity + 1)}
          >
            <span className="relative bottom-[2px] lg:bottom-1 2xl:bottom-[2px]">
              +
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
