import { SearchIcon } from '../assets'

export default function Search({ input, setInput }: any) {
  return (
    <div className="px-4 w-full max-w-[350px] h-[30px] flex items-center space-x-5 text-black dark:text-white">
      <SearchIcon />
      <input
        className="w-full rounded-sm px-4 py-2 bg-moon-orange bg-opacity-25 text-moon-orange placeholder:text-moon-orange"
        onChange={({ target }) => setInput(target.value)}
        value={input}
        type="text"
        name="search"
        placeholder="Search..."
      />
    </div>
  )
}
