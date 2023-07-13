import GradientLink from '../components/layout/GradientLink'

export default function FourOhFour() {
  return (
    <div className="flex flex-col justify-center items-center text-center md:w-[80%] w-screen card rounded-[15px] border-[0.5px] border-gray-300 bg-black bg-opacity-30 shadow-indigo-40 text-white font-RobotoMono shadow-md overflow-visible p-[5%] relative right-4">
      <h1 className="font-GoodTimes text-3xl my-[5%]">
        This page could not be found.
      </h1>
      <p></p>
      <GradientLink
        text={'Home'}
        href="/"
        internal={false}
        textSize={'md'}
      ></GradientLink>
    </div>
  )
}
