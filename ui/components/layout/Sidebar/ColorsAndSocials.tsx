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
        className="h-8 w-8 fill-current text-blue-900 dark:text-moon-gold"
        onClick={() => setLightMode(!lightMode)}
      >
        {lightMode ? <MoonIcon /> : <SunIcon />}
      </button>
      <a
        className="ml-5"
        aria-label="Link to Discord"
        href="https://discord.com/invite/5nAu7K9aES"
        target="_blank"
        rel="noreferrer"
      >
        <DiscordIcon />
      </a>
      <a
        className="ml-5"
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
