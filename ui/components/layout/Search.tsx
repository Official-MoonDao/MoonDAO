import Image from 'next/image'
import Frame from '@/components/layout/Frame'
import { SearchIcon } from '../assets'

export default function Search({ input, setInput }: any) {
  return (
    <div className="relative px-4 bg-search w-full max-w-[350px] flex items-center space-x-2 text-black dark:text-white">
      <div id="search-icon-bg" className="bg-search"></div>
      <Image
        src="/assets/icon-mag.svg"
        alt="Search Icon"
        width={20}
        height={20}
      />
      <div id="input-field-container" className="">
        <Frame noPadding marginBottom="0px">
          <input
            className="w-full rounded-sm px-4 pt-2 pb-4 bg-dark-cool text-white placeholder:text-grey outline-none"
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
