/// <reference types="node" />
/// <reference types="mocha" />
import assert from 'assert'
import {
  activeUsersFromReport,
  forecastSubmittedByEntryReport,
  moonbaseEngagedUsersReport,
  runGa4Report,
} from './ga4DataApi'

describe('moonbase report queries', () => {
  const previous = {
    property: process.env.GA4_PROPERTY_ID,
    json: process.env.GA4_SERVICE_ACCOUNT_JSON,
  }

  afterEach(() => {
    if (previous.property === undefined) delete process.env.GA4_PROPERTY_ID
    else process.env.GA4_PROPERTY_ID = previous.property
    if (previous.json === undefined) delete process.env.GA4_SERVICE_ACCOUNT_JSON
    else process.env.GA4_SERVICE_ACCOUNT_JSON = previous.json
  })

  it('asks for engaged users on /moonbase', () => {
    assert.deepStrictEqual(moonbaseEngagedUsersReport('2026-11-01', '2026-11-02'), {
      dateRanges: [{ startDate: '2026-11-01', endDate: '2026-11-02' }],
      metrics: [{ name: 'activeUsers' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            { filter: { fieldName: 'eventName', stringFilter: { value: 'moonbase_engaged' } } },
            {
              filter: {
                fieldName: 'pagePath',
                stringFilter: { matchType: 'BEGINS_WITH', value: '/moonbase' },
              },
            },
          ],
        },
      },
    })
  })

  it('asks for predictions whose session started on /moonbase', () => {
    const body = forecastSubmittedByEntryReport('2026-11-01', '2026-11-02')
    const filters = body.dimensionFilter.andGroup.expressions
    assert.strictEqual(filters[0].filter.stringFilter.value, 'forecast_submitted')
    assert.deepStrictEqual(filters[1].filter, {
      fieldName: 'customEvent:entry_path',
      stringFilter: { matchType: 'BEGINS_WITH', value: '/moonbase' },
    })
  })

  it('reads active users from a report row and zero from an empty report', () => {
    assert.strictEqual(
      activeUsersFromReport({
        metricHeaders: [{ name: 'activeUsers' }],
        rows: [{ metricValues: [{ value: '4' }] }],
      }),
      4
    )
    assert.strictEqual(activeUsersFromReport(undefined), 0)
    assert.strictEqual(activeUsersFromReport({}), 0)
  })

  it('refuses to run a report when the secrets are missing', async () => {
    delete process.env.GA4_PROPERTY_ID
    delete process.env.GA4_SERVICE_ACCOUNT_JSON
    await assert.rejects(
      () => runGa4Report(moonbaseEngagedUsersReport('2026-11-01', '2026-11-02')),
      /Missing GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON/
    )
  })
})
