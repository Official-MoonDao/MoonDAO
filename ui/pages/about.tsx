import Head from '../components/layout/Head'

export default function About() {
  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn lg:px-3 lg:pb-14 lg:mt-1 md:max-w-[1080px]">
      <Head title="About" />
      <iframe
        className="absolute top-0 left-0 lg:left-[35px] h-[100vh] overflow-auto w-full"
        src="https://docs.moondao.com"
        allowFullScreen
      />
    </div>
  )
}
