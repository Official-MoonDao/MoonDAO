import { useL2Toggle } from '../../lib/thirdweb/hooks/useL2Toggle'

export default function L2Toggle() {
  const { isL2, toggleLayer } = useL2Toggle()

  return (
    <div className="flex items-center p-4 w-1/2 bg-faded rounded-full">
      <p>L2 Toggle</p>
      <div
        onClick={toggleLayer}
        className="px-[3px] w-[75px] h-[30px] rounded-full dark:bg-stronger-dark"
      >
        <div
          className={`w-[60%] h-[27px] rounded-full dark:bg-dark-highlight duration-300 ease-in-out ${
            isL2 && 'translate-x-[35px]'
          }`}
        />
      </div>
    </div>
  )
}
