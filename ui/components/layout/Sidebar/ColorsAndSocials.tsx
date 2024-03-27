import { MoonIcon, SunIcon } from '@heroicons/react/24/solid'
import { DiscordIcon, TwitterIcon } from '../../assets'

interface ColorsAndSocials {
  lightMode: boolean
  setLightMode: Function
}

const ColorsAndSocials = ({ lightMode, setLightMode }: ColorsAndSocials) => {
  return (
    <div className="flex items-center px-4 md:px-0">
      <button
        aria-label="Toggle Light Mode"
        className="mr-5 h-6 w-6 fill-current text-black dark:text-white hover:scale-105"
        onClick={() => setLightMode(!lightMode)}
      >
        {lightMode ? <MoonIcon /> : <SunIcon />}
      </button>
      <hr className="border-none rounded-sm w-[1px] inline-block h-6 bg-black dark:bg-gray-400" />
      <a
        className="ml-5"
        aria-label="Link to Discord"
        href="https://discord.gg/moondao"
        target="_blank"
        rel="noreferrer"
      >
        <DiscordIcon />
      </a>
      <a
        className="ml-5 text-black"
        aria-label="Link to Twitter"
        href="https://twitter.com/OfficialMoonDAO"
        target="_blank"
        rel="noreferrer"
      >
        <TwitterIcon />
      </a>
    </div>
  )
}

export default ColorsAndSocials
