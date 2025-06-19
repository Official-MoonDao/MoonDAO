import Head from '../components/layout/Head'

export default function Constitution() {
  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn h-screen overflow-hidden">
      <Head title="Constitution" />
      <iframe
        className="absolute top-0 left-0 h-full w-full border-0"
        src="https://docs.moondao.com/Governance/Constitution"
        allowFullScreen
        style={{ height: '100vh', overflow: 'hidden' }}
      />
    </div>
  )
}
