describe('Mission E2E', () => {
  describe('Mission Page', () => {
    it('should load the mission page', () => {
      cy.visit('/launch', { timeout: 60000 })
    })
  })
})
