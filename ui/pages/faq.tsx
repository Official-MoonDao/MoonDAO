import Head from '../components/layout/Head'

export default function FAQ() {
  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn h-screen overflow-hidden fixed inset-0">
      <Head title="FAQ" />
      <iframe
        className="absolute top-0 left-0 h-full w-full border-0"
        src="https://docs.moondao.com/About/FAQ"
        allowFullScreen
        style={{ height: '100vh', overflow: 'hidden' }}
        onLoad={() => {
          // Prevent any scroll restoration
          window.scrollTo(0, 0);
          document.body.style.overflow = 'hidden';
        }}
      />
    </div>
  )
}
