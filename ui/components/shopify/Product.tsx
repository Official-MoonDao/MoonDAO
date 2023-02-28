import Image from 'next/image'
import { useEffect, useState } from 'react'

export default function Product({
  product,
  label,
  quantity,
  setQuantity,
}: any) {
  const [preview, setPreview] = useState(0)

  return (
    <div className="w-full backdropBlur flex justify-center items-center">
      <div className="flex flex-col m-4">
        <h1 className="font-GoodTimes mx-4">{label}</h1>
        <div className="m-2">
          <Image
            className="rounded-2xl backdropBlur"
            src={product.images[preview].src}
            width={550}
            height={500}
          />
        </div>
        <div className="flex justify-center items-center mb-2">
          {product?.images[0] &&
            product.images.map((image: any, i: number) => (
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
        <div className="flex justify-center items-center">
          <div className="flex justify-center items-center gap-[50%] w-1/2">
            <button
              className={`rounded-full btn text-white text-2xl w-1/2 backdropBlur hover:text-n3blue duration-[0.6s] ease-in-ease-out ${
                preview === 0 && 'disabled opacity-[0.3]'
              }`}
              onClick={() => (preview > 0 ? setPreview(preview - 1) : '')}
            >
              {'<'}
            </button>

            <button
              className={`rounded-full btn text-white text-2xl w-1/2 backdropBlur hover:text-n3blue duration-[0.6s] ease-in-ease-out ${
                product?.images[0] &&
                preview === product.images.length - 1 &&
                'disabled opacity-[0.3]'
              }`}
              onClick={() => {
                if (!product?.images) return
                preview < product.images.length - 1
                  ? setPreview(preview + 1)
                  : ''
              }}
            >
              {'>'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col w-full mx-4 justify-center items-center gap-4">
        <div className="flex flex-col items-left justify-center h-full gap-[15%]">
          <div>
            <p className="text-2xl text-n3blue">
              {'Quantity:'}
              <span>
                <p className="text-white">{quantity}</p>
              </span>
            </p>
          </div>
          <div>
            <p className="text-2xl text-n3blue">Total:</p>
            <p className="text-2xl ">{`$${
              product?.variants
                ? (product.variants[0].price.amount * quantity).toFixed(2)
                : 0
            }`}</p>
          </div>
        </div>
        <div className="my-2 flex justify-center items-center gap-8 w-full">
          <button
            className={`border-style btn text-n3blue normal-case font-medium w-1/4 bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out ${
              quantity <= 0 && 'disable opacity-[0.5]'
            }`}
            onClick={() => setQuantity(quantity > 0 ? quantity - 1 : 0)}
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
      </div>
    </div>
  )
}
