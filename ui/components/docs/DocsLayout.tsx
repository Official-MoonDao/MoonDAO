import type { DocsPageProps } from '@/lib/docs/types'
import DocMarkdown from './DocMarkdown'
import DocsBacklinks from './DocsBacklinks'
import DocsBreadcrumbs from './DocsBreadcrumbs'
import DocsSearch from './DocsSearch'
import DocsSidebar from './DocsSidebar'
import DocsTOC from './DocsTOC'

export default function DocsLayout({ page }: { page: DocsPageProps }) {
  return (
    <div className="flex w-full min-h-[calc(100vh-4rem)]">
      <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-white/10 bg-black/20 px-4 py-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
        <DocsSearch />
        <DocsSidebar currentSlug={page.slug} />
      </aside>

      <div className="flex-1 min-w-0">
        <div className="lg:hidden px-4 pt-4">
          <details className="bg-black/30 border border-white/10 rounded-xl p-3">
            <summary className="cursor-pointer text-sm text-white/70">Documentation menu</summary>
            <div className="mt-3">
              <DocsSearch />
              <DocsSidebar currentSlug={page.slug} />
            </div>
          </details>
        </div>

        <div className="flex">
          <main className="flex-1 min-w-0 px-4 sm:px-8 py-8 max-w-3xl mx-auto">
            <DocsBreadcrumbs crumbs={page.breadcrumbs} />
            <p className="text-[11px] uppercase tracking-wider text-white/30 mb-2">
              {page.kind === 'doc' ? page.slug : page.kind}
            </p>
            <h1 className="font-GoodTimes text-3xl md:text-4xl text-white mb-6">{page.title}</h1>
            {page.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {page.tags.map((tag) => (
                  <a
                    key={tag}
                    href={`/docs/tags/${tag.toLowerCase()}`}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 hover:text-white"
                  >
                    {tag}
                  </a>
                ))}
              </div>
            )}
            <DocMarkdown body={page.body} />
            <DocsBacklinks items={page.backlinks} />
          </main>

          <aside className="hidden xl:block w-56 shrink-0 px-4 py-8 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <DocsTOC items={page.toc} />
          </aside>
        </div>
      </div>
    </div>
  )
}
