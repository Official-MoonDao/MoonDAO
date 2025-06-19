import Head from '../components/layout/Head'

export default function FAQ() {
  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn">
      <Head title="FAQ" />
      <iframe
        className="absolute top-0 left-0 h-[100vh] overflow-auto w-full"
        src="https://docs.moondao.com/About/FAQ"
        allowFullScreen
      />
    </div>
  )
}
