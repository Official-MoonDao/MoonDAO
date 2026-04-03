import FileInput from '@/components/layout/FileInput'

describe('<FileInput />', () => {
  let props: any

  beforeEach(() => {
    props = { file: undefined, setFile: cy.stub() }
    cy.mount(<FileInput {...props} />)
  })

  it('Should display upload prompt initially', () => {
    cy.contains('Drop your image here').should('exist')
    cy.contains('browse').should('exist')
  })

  it('Should update file name when a file is selected', () => {
    // Create a mock file
    const fileName = 'example.png'
    const file = new File(['file content'], fileName, { type: 'image/png' })

    // Simulate file selection
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('file content'),
      fileName: fileName,
      mimeType: 'image/png',
    }, { force: true })

    // Check if the file name is displayed
    cy.contains(fileName).should('exist')
  })
})
