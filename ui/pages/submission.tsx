import React from 'react';
import { Tab } from '@headlessui/react';
import { NanceProvider } from "@nance/nance-hooks";
import { NANCE_API_URL } from "../lib/nance/constants";
import Container from '../components/layout/Container';
import ContentLayout from '../components/layout/ContentLayout';
import ProposalEditor from '../components/nance/ProposalEditor';
import ContributionEditor from '../components/contribution/ContributionEditor';
import WebsiteHead from '../components/layout/Head';
import { NoticeFooter } from '../components/layout/NoticeFooter';

const SubmissionPage: React.FC = () => {
  const title = 'Submit to MoonDAO';
  const headerContent = (
    <div>
      <p>Submit a proposal for funding or contribute to existing projects.</p>
    </div>
  );

  return (
    <>
      <WebsiteHead title={title} description={headerContent} />
      <section className="flex flex-col justify-center items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Submit to MoonDAO"
            headerSize="40px"
            description={headerContent}
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <Tab.Group>
              <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
                <Tab className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5 
                  ${selected 
                    ? 'bg-white text-blue-700 shadow'
                    : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'}`
                }>
                  Submit Proposal
                </Tab>
                <Tab className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5 
                  ${selected 
                    ? 'bg-white text-blue-700 shadow'
                    : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'}`
                }>
                  Submit Contribution
                </Tab>
              </Tab.List>
              <Tab.Panels className="mt-4">
                <Tab.Panel>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold mb-2">New Proposal</h2>
                    <p className="text-gray-300">
                      Submit a proposal to receive financing or support from the MoonDAO community. Please refer to {' '}
                      <a href="https://docs.moondao.com/Projects/Project-System" className="text-blue-400 hover:text-blue-300 underline">
                        our documentation
                      </a>
                      {' '}for more details on the project system and governance processes before getting started.
                    </p>
                  </div>
                  <NanceProvider apiUrl={NANCE_API_URL}>
                    <ProposalEditor />
                  </NanceProvider>
                </Tab.Panel>
                <Tab.Panel>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold mb-2">New Contribution</h2>
                    <p className="text-gray-300">
                      What have you done to accelerate the impact of MoonDAO's mission? The community circle is an open-ended project to reward permissionless projects. Submit proof of work and earn your share of the quarterly reward pool at the senate's discretion.
                    </p>
                  </div>
                  <ContributionEditor />
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
          </ContentLayout>
          <NoticeFooter />
        </Container>
      </section>
    </>
  );
};

export default SubmissionPage;
