import Link from 'next/link'
import React from 'react'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'

const ThankYou: React.FC = () => {
  return (
    <section id="main-section" className="overflow-auto">
      <Container containerwidth>
        <ContentLayout
          header="Thank You"
          headerSize="max(25px, 4vw)"
          description={
            <>
              We've received your response. <br></br>
              <Link href="/" className="text-white underline">
                CLICK HERE
              </Link>
              &nbsp; to go back to the homepage
            </>
          }
        />
      </Container>
    </section>
  )
}

export default ThankYou
