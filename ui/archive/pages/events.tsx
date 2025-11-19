import useTranslation from 'next-translate/useTranslation'
import WebsiteHead from '../components/layout/Head'

export default function Events() {
  const { t } = useTranslation('common')

  return (
    <>
      <WebsiteHead title={t('eventsTitle')} description={t('eventsDesc')} />
      {/* Fullscreen container with minimal top spacing */}
      <div className="fixed inset-0 w-full h-screen pt-16">
        {/* Loading indicator */}
        <div id="luma-loading" className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg">Loading events...</p>
          </div>
        </div>
        
        {/* Only embeddable luma content - calendar widget */}
        <iframe
          src="https://lu.ma/embed/calendar/cal-7mKdy93TZVlA0Xh/events?lt=dark"
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 'none', width: '100%', height: 'calc(100vh - 4rem)' }}
          allowFullScreen
          aria-hidden="false"
          tabIndex={0}
          className="relative z-20"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="MoonDAO Events Calendar"
          onLoad={(e) => {
            const loadingDiv = document.getElementById('luma-loading');
            if (loadingDiv) {
              loadingDiv.style.display = 'none';
            }
          }}
        />
      </div>
    </>
  )
}
