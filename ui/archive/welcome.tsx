import Constitution from '../components/home/Constitution'
import Hero from '../components/home/Hero'
import Mission from '../components/home/Mission'
import NewsletterSignup from '../components/home/NewsletterSignup'
import SpaceSerious from '../components/home/SpaceSerious'

export default function Home() {
  return (
    <div className="animate-fadeIn flex flex-col gap-24 p-8">
      <Hero />
      <Mission />
      <Constitution />
      <SpaceSerious />
      <NewsletterSignup />
    </div>
  )
}
