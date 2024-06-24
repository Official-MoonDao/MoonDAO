import { useRouter } from 'next/router';
import { ReactNode } from 'react';

interface CardProps {
  icon: ReactNode;
  header: string;
  paragraph: ReactNode;
}

function Card({ icon, header, paragraph }: CardProps) {
  return (
    <div className="w-full h-full flex lg:flex-col rounded-[20px] relative">
      <div className="divider-8 absolute w-[80%] h-full"></div>
      <div className="bg-dark-cool h-full p-5 pb-10 md:pb-20 rounded-[20px] overflow-hidden">
        <div className="relative flex md:flex-col md:items-center max-w-[450px]">
          <div className="pt-2.5 md:pt-0 w-[20%] pr-5 md:w-1/2 md:ml-[-20%] h-full md:p-5">
            {icon}
          </div>
          <div>
            <h2 className="sub-header min-h-[80px] font-GoodTimes flex items-center">
              {header}
            </h2>
            <p className="ml-[-20%] md:ml-0">
              {paragraph}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

type PageCardsProps = {
  sections: any;
  id: string;
  header?: string;
  title: string;
  description: any;
};

export function PageCards({ sections, id, header, title, description }: PageCardsProps) {
  const router = useRouter();

  return (
    <div className="clipped-div w-[336px] sm:w-[400px] lg:w-[600px] lg:max-w-[1080px] font-[Lato] flex flex-col">
      {header && (
        <p className="text-[#071732] dark:text-white font-RobotoMono font-semibold text-sm lg:text-base text-center lg:text-left">
          {header}
        </p>
      )}
      <h1 className="mt-2 lg:mt-3 leading-relaxed page-title">{title}</h1>

      <div className="mt-4 lg:mt-5 font-Lato text-base lg:text-lg dark:text-white text-[#071732] opacity-60">
        {description}
      </div>
      <div id={id} className="mx-auto mt-8 max-w-2xl lg:mt-12 xl:mt-14 lg:max-w-none">
        {sections.map((section: any, i: number) => (
          <div key={id + 'page-cards' + i} className="mb-8">
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
                  <Card
                    icon={<page.icon className="h-8 w-8 stroke-2 flex-none" aria-hidden="true" />}
                    header={page.name}
                    paragraph={
                      <>
                        {page.description}
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
                      </>
                    }
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}