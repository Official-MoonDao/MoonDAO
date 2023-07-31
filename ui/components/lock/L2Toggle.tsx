import { useL2Toggle } from '../../lib/thirdweb/hooks/useL2Toggle'

export default function L2Toggle() {
  const { isL2, toggleLayer } = useL2Toggle()

  return (
    <div className="flex items-center rounded-full gap-3 bg-detail-light dark:bg-stronger-dark py-2 pl-5 w-[200px]">
      <p className='font-semibold tracking-wide text-gray-50'>L2 Toggle</p>
      <div
        onClick={toggleLayer}
        className="relative w-[75px] h-[28px] rounded-full bg-gray-300 dark:bg-slate-200"
      >
        <div
          className={`absolute -top-[3px] h-[33px] w-[33px] rounded-full bg-moon-blue dark:bg-moon-gold duration-300 ease-in-out ${
            isL2 && 'translate-x-[45px]'
          }`}
        />
      </div>
    </div>
  )
}
