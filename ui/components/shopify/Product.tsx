import Image from 'next/image'
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
        <div className="flex flex-col">
          <div className="flex flex-col items-center justify-center my-3">
            <p className="lg:w-3/4 mt-2 md:mt-4 text-sm font-[Lato] leading-relaxed lg:text-base lg:text-left lg:self-start xl:text-lg text-gray-900 dark:text-white opacity-90">
              MoonDAO is partnering with lifeship to send images to space!
              Please upload a file and complete the checkout.
            </p>
          </div>
          {/*NFT kit */}
          <div className="p-5 flex flex-col  lg:items-start  inner-container-background lg:max-w-[700px] rounded">
            <h3 className="title-text-colors font-GoodTimes text-center text-3xl lg:text-left leading-relaxed w-full">
              IMAGE KIT
            </h3>
            <section className="flex flex-col items-center">
              {product?.images?.[preview] && (
                <Image
                  id="product-image"
                  className="mt-5 rounded-2xl block"
                  src={product.images[preview].src}
                  width={450}
                  height={450}
                  alt={`product-${preview}`}
                />
              )}
              {/*Buttons to toggle products*/}
              {product?.images?.length > 0 && (
                <div className="flex items-center gap-4 my-2">
                  <button
                    className={`rounded-full bg-slate-800 px-2 text-white text-xl backdropBlur py-1 hover:text-orange-500 duration-150 transition-all ease-in-ease-out`}
                    onClick={() =>
                      preview > 0
                        ? setPreview(preview - 1)
                        : setPreview((product.images?.length || 1) - 1)
                    }
                  >
                    {'<'}
                  </button>
                  <div className="flex items-center mb-2 relative bottom-1">
                    {product?.images?.map((image: any, i: number) => (
                      <button
                        key={'pagination' + i}
                        className={`${
                          preview === i && 'text-moon-orange'
                        } text-4xl hover:scale-110 transition-all duration-150 px-2`}
                        onClick={() => setPreview(i)}
                      >
                        .
                      </button>
                    ))}
                  </div>
                  <button
                    className={`rounded-full bg-slate-800 px-2 text-white text-xl py-1 hover:text-orange-500 duration-150 transition-all ease-in-ease-out`}
                    onClick={() => {
                      if (!product?.images?.length) return
                      preview < product.images.length - 1
                        ? setPreview(preview + 1)
                        : setPreview(0)
                    }}
                  >
                    {'>'}
                  </button>
                </div>
              )}
            </section>
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
        <h2 className="w-full mt-4 mx-4 text-center xl:text-lg 2xl:mr-2 title-text-colors font-semibold">
          {label}
        </h2>
        <div className="p-2">
          {product?.images?.[preview] && (
            <Image
              id="product-image"
              className={`rounded-2xl bg-gray-100 dark:bg-slate-800`}
              src={product.images[preview].src}
              width={250}
              height={250}
              alt={`product-${preview}`}
            />
          )}
        </div>

        {/*Product pagination*/}
        {product?.images?.length > 0 && (
          <div className="w-full flex justify-center items-center">
            <button
              className={`rounded-full bg-slate-800 w-8 h-8 lg:w-7 lg:h-7 2xl:w-8 2xl:h-8 text-white text-xl backdropBlur hover:text-n3blue duration-[0.6s] ease-in-ease-out`}
              onClick={() =>
                preview > 0
                  ? setPreview(preview - 1)
                  : setPreview((product.images?.length || 1) - 1)
              }
            >
              {'<'}
            </button>
            <div className="flex items-center relative bottom-2">
              {product?.images?.map((image: any, i: number) => (
                <button
                  key={'pagination' + i}
                  className={`${
                    preview === i && 'text-moon-orange'
                  } text-3xl hover:scale-110 px-1`}
                  onClick={() => setPreview(i)}
                >
                  .
                </button>
              ))}
            </div>
            <button
              className={`rounded-full bg-slate-800 w-8 h-8 lg:w-7 lg:h-7 2xl:w-8 2xl:h-8 text-white text-xl backdropBlur hover:text-moon-orange duration-[0.6s] ease-in-ease-out`}
              onClick={() => {
                if (!product?.images?.length) return
                preview < product.images.length - 1
                  ? setPreview(preview + 1)
                  : setPreview(0)
              }}
            >
              {'>'}
            </button>
          </div>
        )}
      </div>

      {/*Plus, Minus, quantity, total*/}
      <div className="mt-2 flex flex-col justify-center items-center max-w-3/4 text-gray-900 dark:text-white">
        <div className="flex justify-center items-center w-full">
          <button
            className={`absolute left-[4%] text-xl border border-black dark:border-white rounded-full px-2 hover:scale-105 transition-all duration-150 ${
              quantity <= 0 && 'disable opacity-[0.5] pointer-events-none'
            }`}
            onClick={() => setQuantity(quantity > 0 ? quantity - 1 : 0)}
          >
            <span className="">-</span>
          </button>
          {/*Quantity and total */}
          <div className="flex flex-col justify-center items-center gap-1">
            <div className="w-full">
              <p className=" text-sm">
                {'Quantity:'}
                <span className="ml-2 text-moon-orange">{quantity}</span>
              </p>
            </div>
            <div className="w-full">
              <p className="text-sm">
                {'Total:'}
                <span className="ml-2 text-moon-orange">{`$${
                  product?.variants?.[0]?.price?.amount
                    ? (product.variants[0].price.amount * quantity).toFixed(2)
                    : 0
                }`}</span>
              </p>
            </div>
          </div>
          <button
            className="absolute right-[4%] text-xl border border-black dark:border-white rounded-full px-2 hover:scale-105 transition-all duration-150"
            onClick={() => setQuantity(quantity + 1)}
          >
            <span className="">+</span>
          </button>
        </div>
      </div>
    </div>
  )
}
