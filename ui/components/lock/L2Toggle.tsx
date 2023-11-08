import { useL2Toggle } from '../../lib/thirdweb/hooks/useL2Toggle'

// Fix "toggle Layer" so it selects the layer according to the name instead of toggling between them.

//if is l2 highlight polygon, otherwise highlight ethereum
export default function L2Toggle() {
  const { isL2, toggleLayer } = useL2Toggle()
  return (
    <div
      className={`flex items-center rounded justify-around bg-white bg-opacity-[0.08] py-2 w-[235px] transtion-all ${
        isL2 && ''
      }`}
    >
      <button
        onClick={toggleLayer}
        className={`rounded px-3 py-[10px] w-[101px] transition-all duration-150 ${
          !isL2 && 'bg-[#CBE4F7] text-black font-semibold '
        }`}
      >
        Ethereum
      </button>
      <button
        onClick={toggleLayer}
        className={` rounded px-3 py-[10px]  w-[101px] transition-all duration-150 ${
          isL2 && 'bg-[#CBE4F7] text-black font-semibold'
        }`}
      >
        Polygon
      </button>
    </div>
  )
}
