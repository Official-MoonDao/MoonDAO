import Image from 'next/image'
import Frame from '@/components/layout/Frame'
import { SearchIcon } from '../assets'

export default function Search({ input, setInput, className }: any) {
  return (
    <div
      className={`relative pl-4 bg-search w-full flex items-center space-x-2 text-black dark:text-white ${className} md:max-w-[500px]`}
    >
      <div id="search-icon-bg" className="bg-search"></div>
      <Image
        src="/assets/icon-mag.svg"
        alt="Search Icon"
        width={20}
        height={20}
      />
      <div id="input-field-container" className="flex-grow">
        <Frame noPadding marginBottom="0px">
          <input
            className="w-full rounded-sm px-4 pt-2 pb-3 bg-dark-cool text-white placeholder:text-grey outline-none"
            onChange={({ target }) => setInput(target.value)}
            value={input}
            type="text"
            name="search"
            placeholder="Search..."
          />
        </Frame>
      </div>
    </div>
  )
}
