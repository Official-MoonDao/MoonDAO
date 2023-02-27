// import Image from 'next/image'
// import { useEffect, useState } from 'react'

// export default function Product({
//   product,
//   label,
//   quantity,
//   setQuantity,
// }: any) {
//   const [preview, setPreview] = useState(0)

//   return (
//     <div className="flex justify-center items-center w-full">
//       <h1>{label}</h1>
//       <div className="flex flex-col">
//         <Image
//           className="rounded-2xl backdropBlur"
//           src={product.images[preview].src}
//           width={200}
//           height={200}
//         />
//         <div className="flex justify-center items-center">
//           {product?.images[0] &&
//             product.images.map((image: any, i: number) => (
//               <button
//                 key={'pagination' + i}
//                 className={`${
//                   preview === i && 'text-n3blue'
//                 } text-3xl hover:scale-[1.025]`}
//                 onClick={() => setPreview(i)}
//               >
//                 .
//               </button>
//             ))}
//           <div className="flex justify-center items-center gap-[22%] w-1/2">
//             <button
//               className={`border-style btn text-n3blue normal-case font-medium w-1/2 bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out ${
//                 preview === 0 && 'disabled opacity-[0.5]'
//               }`}
//               onClick={() => (preview > 0 ? setPreview(preview - 1) : '')}
//             >
//               {'<'}
//             </button>

//             <button
//               className={`border-style btn text-n3blue normal-case font-medium w-1/2 bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out ${
//                 product?.images[0] &&
//                 preview === product.images.length - 1 &&
//                 'disabled opacity-[0.5]'
//               }`}
//               onClick={() => {
//                 if (!product?.images) return
//                 preview < product.images.length - 1
//                   ? setPreview(preview + 1)
//                   : ''
//               }}
//             >
//               {'>'}
//             </button>
//           </div>
//         </div>
//       </div>

//       <div className="w-3/4 flex justify-center items-center gap-4 ">
//         <div className="flex gap-2 justify-center">
//           <p className="text-3xl text-n3blue">Quantity:</p>
//           <p className="text-3xl">{quantity}</p>
//         </div>
//         <div className="flex gap-2 justify-center">
//           <p className="text-3xl text-n3blue">Total:</p>
//           <p className="text-3xl">{`$${
//             product?.variants
//               ? (product.variants[0].price.amount * quantity).toFixed(2)
//               : 0
//           }`}</p>
//         </div>
//         <div className="my-2 flex justify-center items-center gap-8 w-full">
//           <button
//             className={`border-style btn text-n3blue normal-case font-medium w-1/4 bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out ${
//               quantity <= 0 && 'disable opacity-[0.5]'
//             }`}
//             onClick={() => setQuantity(quantity > 0 ? quantity - 1 : 0)}
//           >
//             -
//           </button>
//           <button
//             className="border-style btn text-n3blue normal-case font-medium w-1/4 bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out"
//             onClick={() => setQuantity(quantity + 1)}
//           >
//             +
//           </button>
//         </div>
//       </div>
//     </div>
//   )
// }
