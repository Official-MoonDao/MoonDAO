import React from 'react'
import Product from '../../../components/shopify/Product'

describe('<Product />', () => {
  let dummyProduct: any
  before(() => {
    //load product test data from fixture
    cy.fixture('shopify/product').then((prod) => {
      dummyProduct = prod
    })
  })

  it('Renders Shopify Product', () => {
    const { product, label, quantity } = dummyProduct

    const prodEl = cy.mount(
      <Product
        product={product}
        label={label}
        quantity={quantity}
        setQuantity={(q: number) => console.log('q')}
        linkToStore={false}
      />
    )
    //check product data
    prodEl.get('#product-image').should('exist').wait(3000)

    //test adding quantity
    prodEl.get('button').contains('+').click()
    prodEl.get('button').contains('-').click()

    //test pagination
    prodEl.get('button').contains('>').click()
    prodEl
      .get('#product-image')
      .should('have.attr', 'alt', 'product-1')
      .wait(1000)

    prodEl.get('button').contains('<').click()
    prodEl
      .get('#product-image')
      .should('have.attr', 'alt', 'product-0')
      .wait(1000)
  })

  it('Renders Shopify Product with link to store', () => {
    const { product, label, quantity } = dummyProduct

    const prodEl = cy.mount(
      <Product
        product={product}
        label={label}
        quantity={quantity}
        setQuantity={(q: number) => console.log('q')}
        linkToStore={() => console.log('link to store')}
      />
    )
    //check product data
    prodEl.get('#product-image').should('exist')

    //test pagination
    prodEl.get('button').contains('>').click()
    prodEl
      .get('#product-image')
      .should('have.attr', 'alt', 'product-1')
      .wait(1000)

    prodEl.get('button').contains('<').click()
    prodEl
      .get('#product-image')
      .should('have.attr', 'alt', 'product-0')
      .wait(1000)

    //check link to store
    prodEl
      .get('#link-to-store')
      .click()
      .then(() => cy.log('link clicked'))
      .wait(3000)
  })
})
