import Head from '../components/layout/Head'

export default function PrivacyPolicy() {
  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn h-screen overflow-hidden fixed inset-0">
      <Head 
        title="Privacy Policy" 
        description="Read MoonDAO's Privacy Policy to understand how we collect, use, and protect your personal information."
      />
      <iframe
        className="absolute top-0 left-0 h-full w-full border-0"
        src="https://docs.moondao.com/Legal/Website-Privacy-Policy"
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
