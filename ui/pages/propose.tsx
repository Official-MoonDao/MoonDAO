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
  const description = 'MoonDAO Projects are mission-driven initiatives led by small teams working together to achieve objectives aligned with our mission. By submitting a proposal, you can seek funding and gain support from the community. Proposals are reviewed by the Senate to ensure they follow best practices and contribute to our shared mission, prior to going up for a DAO-wide community vote. Please refer to our documentation for more details on the project system and the MoonDAO constitution, before getting started.';

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
