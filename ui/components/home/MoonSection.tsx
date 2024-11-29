import dynamic from 'next/dynamic'

const Moon = dynamic(() => import('@/components/globe/Moon'), { ssr: false })

export default function MoonSection() {
  return (
    <section
      id="moon-section"
      className="relative items-start max-w-[1200px] justify-end md:items-start lg:items-start md:justify-end lg:justify-center mt-[5vmax]"
    >
      <Moon rotateOnMouseMove rotationFactor={0.1} enableZoom={false} />
    </section>
  )
}
