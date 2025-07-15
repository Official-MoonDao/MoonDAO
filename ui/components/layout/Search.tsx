import Image from 'next/image'
import Frame from '@/components/layout/Frame'
import { SearchIcon } from '../assets'

interface SearchProps {
  input: string
  setInput: (value: string) => void
  className?: string
  placeholder?: string
}

export default function Search({ input, setInput, className, placeholder = "Search..." }: SearchProps) {
  return (
    <div
      className={`relative w-auto flex items-center space-x-2 ${className}`}
    >
      <Image
        src="/assets/icon-mag.svg"
        alt="Search Icon"
        width={14}
        height={14}
        className="text-slate-400"
      />
      <div id="input-field-container" className="flex-1 min-w-0">
        <input
          className="w-full px-1 py-1 bg-transparent text-white placeholder:text-slate-400 outline-none border-0 focus:ring-0 text-sm leading-none h-7"
          onChange={({ target }) => setInput(target.value)}
          value={input}
          type="text"
          name="search"
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}
