import React from 'react';
import { NanceProvider } from "@nance/nance-hooks";
import ProposalEditor from "../components/nance/ProposalEditor";
import { NANCE_API_URL } from "../lib/nance/constants";
import Container from '../components/layout/Container';
import ContentLayout from '../components/layout/ContentLayout';
import WebsiteHead from '../components/layout/Head';
import { useRouter } from 'next/router'; // Add this import
import { NoticeFooter } from '../components/layout/NoticeFooter';

export default function NewProposal() {
  const router = useRouter(); // Initialize the router
  const { proposalId } = router.query; // Get the proposalId from the URL

  // Determine the header text based on the presence of proposalId
  const headerText = proposalId ? "Edit Proposal" : "New Proposal"; 

  const title = 'New Proposal';
  const description = (
    <span>
      <p>Submit a proposal to receive financing or support from the MoonDAO community. Please refer to <u><a href="https://docs.moondao.com/Projects/Project-System">our documentation</a></u> for more details on the project system and governance processes before getting started.</p>
    </span>
  );

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
            <ProposalEditor />
          </NanceProvider>
        </ContentLayout>
        <NoticeFooter />
      </Container>
    </>
  )
}
