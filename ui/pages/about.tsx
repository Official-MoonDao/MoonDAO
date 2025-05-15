import Head from '../components/layout/Head'

export default function About() {
  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn">
      <Head title="About" />
      <iframe
        className="absolute top-0 left-0 h-[100vh] overflow-auto w-full"
        src="https://docs.moondao.com"
        allowFullScreen
      />
    </div>
  )
}
