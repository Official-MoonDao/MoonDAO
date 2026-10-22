import { expect, test } from '@playwright/test'

/**
 * Regression guard for the GA4 page view.
 * The stub stands in for gtag.js Enhanced Measurement: one page view from
 * config, and one more when history changes. The app must not send its own
 * page view. Shallow updates call the original history method, so the stub
 * does not see them.
 */
const GTAG_STUB = `
  (function () {
    window.__ga4PageViews = window.__ga4PageViews || [];
    function page() { return location.pathname + location.search; }
    function record(source) {
      var views = window.__ga4PageViews;
      var current = page();
      var last = views.length ? views[views.length - 1].page : '';
      if (source === 'history' && current === last) return;
      views.push({ source: source, page: current });
    }
    function scan(entry) {
      if (!entry || !entry.length) return;
      var opts = entry[2] || {};
      if (entry[0] === 'config' && opts.send_page_view !== false) record('config');
      if (entry[0] === 'event' && entry[1] === 'page_view') record('event');
    }
    var dl = window.dataLayer = window.dataLayer || [];
    var push = dl.push.bind(dl);
    dl.push = function (entry) {
      var result = push(entry);
      scan(entry);
      return result;
    };
    for (var i = 0; i < dl.length; i++) scan(dl[i]);
    function hook(fn) {
      return function () {
        var result = fn.apply(this, arguments);
        record('history');
        return result;
      };
    }
    history.pushState = hook(history.pushState);
    history.replaceState = hook(history.replaceState);
  })();
`

test('one page_view on load and on client navigation, none on a shallow update', async ({
  page,
}) => {
  await page.route('**/gtag/js**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: GTAG_STUB })
  )
  await page.goto('/join-us?email=person@example.com&utm_source=ig', {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForFunction(() => {
    const win = window as unknown as {
      __ga4PageViews?: unknown[]
      next?: { router?: { push?: unknown } }
    }
    return (
      typeof win.__ga4PageViews !== 'undefined' &&
      Boolean((window.history.pushState as unknown as { __mdGuarded?: boolean }).__mdGuarded) &&
      typeof win.next?.router?.push === 'function'
    )
  })

  await expect(page).toHaveURL(/\/join-us\?utm_source=ig$/)
  expect(page.url()).not.toContain('email')

  const afterLoad = await page.evaluate(
    () =>
      (window as unknown as { __ga4PageViews: { source: string; page: string }[] }).__ga4PageViews
  )
  expect(afterLoad.filter((view) => view.page.includes('email'))).toEqual([])
  expect(afterLoad).toHaveLength(1)
  expect(afterLoad[0].source).toBe('config')

  await page.evaluate(() => {
    const router = (window as unknown as { next: { router: { push: Function } } }).next.router
    return router.push('/press')
  })
  await page.waitForURL(/\/press$/)
  const afterNav = await page.evaluate(
    () => (window as unknown as { __ga4PageViews: { source: string }[] }).__ga4PageViews.length
  )
  expect(afterNav).toBe(2)

  await page.evaluate(() => {
    const router = (window as unknown as { next: { router: { push: Function } } }).next.router
    return router.push({ pathname: '/press', query: { page: '2' } }, undefined, { shallow: true })
  })
  await page.waitForTimeout(300)
  const afterShallow = await page.evaluate(
    () =>
      (window as unknown as { __ga4PageViews: { source: string; page: string }[] }).__ga4PageViews
  )
  expect(afterShallow).toHaveLength(2)
  expect(afterShallow.some((view) => view.source === 'event')).toBe(false)
})
