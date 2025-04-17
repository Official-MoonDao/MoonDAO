import Tooltip from './Tooltip'

export type CheckboxProps = {
  label: string
  checked: boolean
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  tooltip?: string
}

export default function Checkbox({
  label,
  checked,
  onChange,
  tooltip,
}: CheckboxProps) {
  return (
    <div className="flex flex-col gap-2 items-start">
      <label
        className="flex gap-4 font-light text-gray-700 select-none max-w-[550px]"
        htmlFor="link"
      >
        <p className="dark:text-white font-GoodTimes opacity-50">{label}</p>
        {tooltip && <Tooltip text={tooltip}>?</Tooltip>}
      </label>
      <label
        className="relative flex items-center p-3 rounded-full cursor-pointer"
        htmlFor="link"
      >
        <input
          checked={checked}
          onChange={onChange}
          type="checkbox"
          className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-md border border-[#D7594F] transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-blue-gray-500 before:opacity-0 before:transition-opacity checked:border-[#D7594F] checked:bg-gray-900 checked:before:bg-gray-900 hover:before:opacity-10"
          id="link"
        />
        <span className="absolute text-white transition-opacity opacity-0 pointer-events-none top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 peer-checked:opacity-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            ></path>
          </svg>
        </span>
      </label>
    </div>
  )
}
