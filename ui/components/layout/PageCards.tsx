import { useRouter } from 'next/router'

export function PageCards({ pages, id, header, title, description }: any) {
  return (
    <div className="mt-3 px-5 lg:px-8 xl:px-9 py-12 lg:py-14 w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] font-RobotoMono">
      {header && (
        <p className="text-[#071732] dark:text-white font-RobotoMono font-semibold text-sm lg:text-base text-center lg:text-left">
          {header}
        </p>
      )}
      <h1 className="mt-2 lg:mt-3 leading-relaxed page-title">{title}</h1>
      <p className="mt-4 lg:mt-5 text-center lg:text-left font-RobotoMono text-base lg:text-lg dark:text-white text-[#071732] opacity-60">
        {description}
      </p>
      <div id={id} className="mx-auto mt-8 max-w-2xl lg:max-w-none">
        <dl
          id={'home-card-pages'}
          className="grid max-w-xl lg:max-w-4xl grid-cols-1 gap-x-12 gap-y-4 lg:grid-cols-2 xl:grid-cols-2"
        >
          {pages.map((page: any, i: number) => (
            <Card key={i} page={page} />
          ))}
        </dl>
      </div>
    </div>
  )
}

function Card({ page }: any) {
  const router = useRouter()
  return (
    <div
      onClick={
        page.href && page.externalLink
          ? () => window.open(page.href)
          : page?.href && !page.externalLink
          ? () => router.push(page.href)
          : page?.onClick
      }
      className="lg:flex mt-7 pb-12 md:pb-8 py-8 px-5 font-RobotoMono text-slate-950 cursor-pointer dark:text-white border-[1px] border-white hover:border-orange-500 hover:border-opacity-20 border-opacity-20"
    >
      <div className="ml-2 mr-6">{page.icon}</div>
      <div className="flex flex-col h-full justify-between">
        <div>
          <h1 className="font-bold text-[20px]">{page.name}</h1>
          <p className="mt-3 opacity-60">{page.description}</p>
        </div>
        <button
          className={`w-min whitespace-nowrap mb-6 lg:mb-0 lg:mt-10 bg-moon-orange group-hover:scale-105 px-5 py-3 transition-all duration-150`}
        >
          {page.buttonText}
        </button>
      </div>
    </div>
  )
}
