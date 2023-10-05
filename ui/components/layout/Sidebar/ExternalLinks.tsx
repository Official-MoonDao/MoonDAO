import Link from 'next/link'

const externalLinks = [
  {
    name: 'Homepage',
    href: 'https://moondao.com',
  },
  {
    name: 'Governance',
    href: `https://snapshot.org/#/tomoondao.eth`,
  },
  {
    name: 'Documentation',
    href: 'https://moondao.com/docs/introduction',
  },
  {
    name: 'Newsletter',
    href: 'https://moondao.ck.page/profile',
  },
  {
    name: 'Marketplace',
    href: 'https://market.moondao.com',
  },
]

const ExternalLinks = () => {
  return (
    <div className="">
      <h3 className="-ml-2 font-medium text-blue-700 dark:text-yellow-200">
        External links
      </h3>
      <ul
        id="layout-external-links"
        className="mt-2 px-3 list-disc marker:text-blue-500 dark:marker:text-yellow-100 group"
        role="group"
      >
        {externalLinks.map((item, i) => (
          <li
            id={'layout-external-link' + i}
            key={i}
            className="py-[6px] hover:scale-105 transition-all duration-100"
          >
            <Link
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center text-[13px] font-medium rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ExternalLinks
