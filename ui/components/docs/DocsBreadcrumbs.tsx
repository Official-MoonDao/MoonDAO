import Link from 'next/link'

export default function DocsBreadcrumbs({
  crumbs,
}: {
  crumbs: { title: string; href: string }[]
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-white/50 mb-4 flex flex-wrap gap-1">
      {crumbs.map((crumb, i) => (
        <span key={`${crumb.href}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span className="text-white/20">/</span>}
          {i === crumbs.length - 1 ? (
            <span className="text-white/70">{crumb.title}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-white transition-colors">
              {crumb.title}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
