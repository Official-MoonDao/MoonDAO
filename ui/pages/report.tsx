import { NanceProvider } from '@nance/nance-hooks'
import { useRouter } from 'next/router'
import React from 'react'
import { NANCE_API_URL } from '../lib/nance/constants'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
// Add this import
import { NoticeFooter } from '../components/layout/NoticeFooter'
import FinalReportEditor from '@/components/nance/FinalReportEditor'

export default function FinalReport() {
  const router = useRouter() // Initialize the router
  const { proposalId } = router.query // Get the proposalId from the URL

  // Determine the header text based on the presence of proposalId
  const headerText = proposalId ? 'Edit Final Report' : 'New Final Report'

  const title = 'New Proposal'
  const description = (
    <span>
      <p>Submit a final report for your project.</p>
    </span>
  )

  return (
    <>
      <WebsiteHead title={title} description={description} />
      <Container>
        <ContentLayout
          header={headerText} // Update this line
          headerSize="40px"
          description={description}
          isProfile={true}
          mainPadding
          mode="compact"
        >
          <NanceProvider apiUrl={NANCE_API_URL}>
            <FinalReportEditor />
          </NanceProvider>
        </ContentLayout>
        <NoticeFooter />
      </Container>
    </>
  )
}
