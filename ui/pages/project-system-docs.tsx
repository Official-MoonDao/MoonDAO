import Head from '../components/layout/Head'

export default function ProjectSystemDocs() {
  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn h-screen overflow-hidden fixed inset-0">
      <Head 
        title="Project System Documentation" 
        description="Learn about MoonDAO's comprehensive project system that supports project funding, progress tracking, and retroactive incentives."
      />
      <iframe
        className="absolute top-0 left-0 h-full w-full border-0"
        src="https://docs.moondao.com/Projects/Project-System"
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
