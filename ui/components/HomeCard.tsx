import Link from 'next/link'
import GradientLink from '../components/GradientLink'

export default function HomeCard({
  href,
  icon,
  title,
  children,
  linkText,
}: any) {
  return (
    <Link href={href} passHref>
      <div className="card transition ease-in-out hover:scale-105 cursor-pointer rounded-[15px] border-[0.5px] border-gray-300 bg-black bg-opacity-30 shadow-indigo-400">
        <div className="card-body items-stretch items-center font-RobotoMono">
          {icon}
          <h2 className="card-title text-center font-medium">{title}</h2>

          {children}

          <GradientLink text={linkText} href={href}></GradientLink>
        </div>
      </div>
    </Link>
  )
}
