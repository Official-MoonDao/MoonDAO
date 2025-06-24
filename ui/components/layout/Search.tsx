import Image from 'next/image'
import Frame from '@/components/layout/Frame'
import { SearchIcon } from '../assets'

export default function Search({ input, setInput, className }: any) {
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
      <div id="input-field-container">
        <input
          className="w-[190px] px-1 py-1 bg-transparent text-white placeholder:text-slate-400 outline-none border-0 focus:ring-0 text-sm leading-none h-7"
          onChange={({ target }) => setInput(target.value)}
          value={input}
          type="text"
          name="search"
          placeholder="Search citizens and teams..."
        />
      </div>
    </div>
  )
}
