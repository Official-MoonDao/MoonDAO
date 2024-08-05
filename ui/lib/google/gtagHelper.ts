declare global {
  interface Window {
    gtag: any
  }
}

export default function pageview(GTAG: string, url: string) {
  window.gtag('config', GTAG, {
    page_path: url,
  })
}
