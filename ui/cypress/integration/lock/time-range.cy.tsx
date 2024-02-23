import React from 'react'
import TimeRange from '../../../components/TimeRange'

describe('<TimeRange />', () => {
  it('Renders Time Range', () => {
    const now = Date.now()
    cy.mount(
      <TimeRange
        id="test-time-range"
        disabled={false}
        time={now}
        min={0}
        max={now}
        displaySteps={false}
        onChange={(newDate: any) => {
          console.log(newDate)
        }}
      />
    )

    cy.get('#test-time-range').should('have.value', now)
  })
})
