export default function ConditionCheckbox({
  id,
  label,
  agreedToCondition,
  setAgreedToCondition,
  disabled = false,
}: any) {
  return (
    <div className="flex gap-2 items-center">
      <label
        className={`relative flex items-center p-3 rounded-full ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        }`}
        htmlFor="link"
      >
        <input
          id={id}
          checked={agreedToCondition}
          onChange={(e) => setAgreedToCondition(e.target.checked)}
          type="checkbox"
          disabled={disabled}
          className={`before:content[''] peer relative h-7 w-7 appearance-none rounded-md border border-white
           transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-blue-gray-500 before:opacity-0 before:transition-opacity checked:border-light-warm checked:bg-gray-900 checked:before:bg-gray-900 hover:before:opacity-10 ${
             disabled ? 'cursor-not-allowed' : 'cursor-pointer'
           }`}
        />
        <span className="absolute text-white transition-opacity opacity-0 pointer-events-none top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 peer-checked:opacity-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
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
      <label
        className={`font-light text-gray-700 select-none max-w-[550px] ${
          disabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
        htmlFor="link"
      >
        <p className="dark:text-white">{label}</p>
      </label>
    </div>
  )
}
