import VerticalStar from '../../../components/marketplace/assets/VerticalStar'

interface Title {
  title: String
}

const SectionHeader = ({ title }: Title) => {
  return (
    <h2 className="z-50 relative font-GoodTimes text-xl tracking-wide flex items-center sm:text-2xl lg:text-[32px]">
      {title}
      <span className="hidden sm:inline-block sm:ml-2 lg:ml-[13px]">
        <VerticalStar />
      </span>
    </h2>
  )
}

export default SectionHeader
