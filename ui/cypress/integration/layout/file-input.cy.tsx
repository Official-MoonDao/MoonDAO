import FileInput from '@/components/layout/FileInput'

describe('<FileInput />', () => {
  let props: any

  beforeEach(() => {
    props = { file: undefined, setFile: cy.stub() }
    cy.mount(<FileInput {...props} />)
  })

  it('Should display "No file chosen" initially', () => {
    cy.get('#file-chosen').should('contain.text', 'No file chosen')
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
    })

    // Check if the file name is updated
    cy.get('#file-chosen').should('contain.text', fileName.slice(0, 20))

    // Check if setFile is called with the correct file
    cy.wrap(props.setFile).should('have.been.calledWith', file)
  })
})
