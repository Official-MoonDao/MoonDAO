import { useRouter } from 'next/router'

type PageCardsProps = {
  sections: any
  id: string
  header?: string
  title: string
  description: any
}

export function PageCards({
  sections,
  id,
  header,
  title,
  description,
}: PageCardsProps) {
  const router = useRouter()

  return (
    <div className="mt-3 px-5 lg:px-8 xl:px-9 py-12 lg:py-14 page-border-and-color w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] font-[Lato]">
      {header && (
        <p className="text-[#071732] dark:text-white font-RobotoMono font-semibold text-sm lg:text-base text-center lg:text-left">
          {header}
        </p>
      )}
      <h1 className="mt-2 lg:mt-3 leading-relaxed page-title">{title}</h1>

      <div className="mt-4 lg:mt-5 text-center lg:text-left font-Lato text-base lg:text-lg dark:text-white text-[#071732] opacity-60">
        {description}
      </div>
      <div
        id={id}
        className="mx-auto mt-8 max-w-2xl lg:mt-12 xl:mt-14 lg:max-w-none"
      >
        {sections.map((section: any, i: number) => (
          <dl
            className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-4 lg:max-w-none mb-8"
            key={id + 'page-cards' + i}
          >
            <p className="text-2xl text-center lg:text-left text-gray-950 dark:text-white font-GoodTimes">
              {section.sectionName}
            </p>
            <div className="flex flex-col gap-4" id={id + '-pages'}>
              {section.pages.map((page: any, i: number) => (
                <button
                  onClick={
                    page?.href && page.externalLink
                      ? () => window.open(page.href)
                      : page?.href && !page.externalLink
                      ? () => router.push(page.href)
                      : page?.onClick
                  }
                  key={page.name}
                  className="w-full max-w-[500px] min-h-[150px] flex flex-col items-left text-center inner-container-background rounded-[6px] p-4 gap-x-4 border-transparent border-[1px] hover:border-white transition-all duration-150"
                >
                  <dt className="flex w-full lg:min-w-max items-center justify-start mt-3 lg:mt-0 py-[10px] gap-x-3 text-white text-base font-bold font-RobotoMono lg:w-1/3">
                    <page.icon
                      className="h-8 w-8 stroke-2 flex-none"
                      aria-hidden="true"
                    />
                    {page.name}
                  </dt>
                  <dd className="text-sm leading-7 mb-3 lg:mb-0 mt-2 lg:mt-0 lg:px-1 text-light-text dark:text-white font-medium text-left">
                    <p className="">
                      {page.description}{' '}
                      {page.hyperlink && page.hyperlinkText && (
                        <a
                          href={page.hyperlink}
                          className="text-moon-gold hover:underline"
                          onClick={(e) => e.stopPropagation()}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {page.hyperlinkText}
                        </a>
                      )}
                    </p>
                  </dd>
                </button>
              ))}
            </div>
          </dl>
        ))}
      </div>
    </div>
  )
}
