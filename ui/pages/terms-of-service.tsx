import Head from '../components/layout/Head'

export default function TermsOfService() {
  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn h-screen overflow-hidden fixed inset-0">
      <Head 
        title="Terms of Service" 
        description="Read MoonDAO's Terms and Conditions to understand the terms governing your use of our website and services."
      />
      <iframe
        className="absolute top-0 left-0 h-full w-full border-0"
        src="https://docs.moondao.com/Legal/Website-Terms-and-Conditions"
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
