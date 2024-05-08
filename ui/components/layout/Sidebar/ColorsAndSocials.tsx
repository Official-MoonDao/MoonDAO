import { MoonIcon, SunIcon } from '@heroicons/react/24/solid'
import Link from 'next/link'
import { DiscordIcon, TwitterIcon, GithubIcon } from '../../assets'

interface ColorsAndSocials {
  lightMode: boolean
  setLightMode: Function
}

const ColorsAndSocials = ({ lightMode, setLightMode }: ColorsAndSocials) => {
  return (
    <div className="flex items-center px-4 md:px-0">
      {/* <button
        aria-label="Toggle Light Mode"
        className="mr-5 h-6 w-6 fill-current text-black dark:text-white hover:scale-105"
        onClick={() => setLightMode(!lightMode)}
      >
        {lightMode ? <SunIcon /> : <MoonIcon />}
      </button> */}
      {/* <hr className="border-none rounded-sm w-[1px] inline-block h-6 bg-black dark:bg-gray-400" /> */}
      <Link
        className="hover:scale-105 duration-150 ease-in-out"
        aria-label="Link to Discord"
        href="https://discord.gg/moondao"
        target="_blank"
        rel="noreferrer"
        passHref
      >
        <DiscordIcon />
      </Link>
      <Link
        className="ml-5 hover:scale-105 duration-150 ease-in-out"
        aria-label="Link to Twitter"
        href="https://github.com/Official-MoonDao"
        target="_blank"
        rel="noreferrer"
        passHref
      >
        <GithubIcon />
      </Link>
      <Link
        className="ml-5 hover:scale-105 duration-150 ease-in-out"
        aria-label="Link to Twitter"
        href="https://twitter.com/OfficialMoonDAO"
        target="_blank"
        rel="noreferrer"
        passHref
      >
        <TwitterIcon />
      </Link>
    </div>
  )
}

export default ColorsAndSocials
