import { useRouter } from 'next/router'

export function PageCards({ sections, id, header, title, description }: any) {
  const router = useRouter()

  return (
    <div className="mt-3 px-5 lg:px-8 xl:px-9 py-12 lg:py-14 page-border-and-color w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] font-[Lato]">
      {header && (
        <p className="text-[#071732] dark:text-white font-RobotoMono font-semibold text-sm lg:text-base text-center lg:text-left">
          {header}
        </p>
      )}
      <h1 className="mt-2 lg:mt-3 leading-relaxed page-title">{title}</h1>

      <p className="mt-4 lg:mt-5 text-center lg:text-left font-RobotoMono text-base lg:text-lg dark:text-white text-[#071732] opacity-60">
        {description}
      </p>
      <div
        id={id}
        className="mx-auto mt-8 max-w-2xl lg:mt-12 xl:mt-14 lg:max-w-none"
      >
        {sections.map((section: any, i: number) => (
          <dl
            id={'home-card-pages'}
            className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-4 lg:max-w-none mb-8"
            key={id + 'page-cards' + i}
          >
            <p className="text-2xl text-center lg:text-left text-gray-950 dark:text-white font-RobotoMono">
              {section.sectionName}
            </p>
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
                className="flex flex-col lg:flex-row items-center text-center inner-container-background rounded-[6px] lg:p-4 gap-x-4 hover:scale-105 transition-all duration-150"
              >
                <dt className="flex min-w-max items-center justify-center mt-3 lg:mt-0 py-[10px] px-[16px] gap-x-3 bg-[#CBE4F7] text-[#1F212B] text-base font-bold font-RobotoMono lg:w-1/3">
                  <page.icon
                    className="h-5 w-5 stroke-2 flex-none text-[#1F212B]"
                    aria-hidden="true"
                  />
                  {page.name}
                </dt>
                <dd className="text-sm leading-7 lg:w-2/3 mb-3 lg:mb-0 mt-1 lg:mt-0 px-3 lg:px-1 text-light-text dark:text-white font-medium lg:text-left">
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
          </dl>
        ))}
      </div>
    </div>
  )
}
