import React, { useEffect, useState } from 'react';
import { Tab } from '@headlessui/react';
import { NanceProvider } from "@nance/nance-hooks";
import { NANCE_API_URL } from "../lib/nance/constants";
import Container from '../components/layout/Container';
import ContentLayout from '../components/layout/ContentLayout';
import ProposalEditor from '../components/nance/ProposalEditor';
import ContributionEditor from '../components/contribution/ContributionEditor';
import WebsiteHead from '../components/layout/Head';
import { NoticeFooter } from '../components/layout/NoticeFooter';
import { useRouter } from 'next/router';

const SubmissionPage: React.FC = () => {
  const router = useRouter();
  const { tag } = router.query;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const title = 'Collaborate with MoonDAO';

  useEffect(() => {
    if (tag === 'contribution') {
      setSelectedIndex(1);
    } else {
      setSelectedIndex(0);
    }
  }, [tag]);

  const headerContent = (
    <div>
    </div>
  );

  return (
    <>
      <WebsiteHead title={title} description={headerContent} />
      <section className="flex flex-col justify-center items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Submissions"
            headerSize="40px"
            description={headerContent}
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="flex flex-col gap-4 p-5 bg-slide-section rounded-tl-[2vw] rounded-bl-[2vw]">
              <Tab.Group selectedIndex={selectedIndex} onChange={setSelectedIndex}>
                <Tab.List className="flex rounded-xl">
                  <Tab className={({ selected }) =>
                    `rounded-lg py-2.5 px-5 font-GoodTimes leading-5 focus:outline-none
                    ${selected
                      ? 'bg-gradient-to-r from-[#5757ec] to-[#6b3d79] text-white shadow'
                      : 'text-white/70 hover:text-white'}`
                  }>
                    Submit Proposal
                  </Tab>
                  <Tab className={({ selected }) =>
                    `rounded-lg py-2.5 font-GoodTimes leading-5 px-5 focus:outline-none
                    ${selected
                      ? 'bg-gradient-to-r from-[#5757ec] to-[#6b3d79] text-white shadow'
                      : 'text-white/70 hover:text-white'}`
                  }>
                    Submit Contribution
                  </Tab>
                </Tab.List>
                <Tab.Panels className="mt-4">
                  <Tab.Panel>
                  <div className="mb-8">
                      <p className="text-gray-300">
                        Submit a proposal to receive financing or special permissions from the MoonDAO community. Please refer to {' '}
                        <a 
                          href="https://docs.moondao.com/Projects/Project-System" 
                          className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noreferrer"
                        >
                          our documentation
                        </a>{' '}
                        for more details before getting started. We recommend starting your draft with the {' '}
                        <a 
                          href="https://docs.google.com/document/d/1p8rV9RlvFk6nAJzWh-tvroyPvasjjrvgKpyX8ibGX3I/edit?usp=sharing" 
                          className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noreferrer"
                        >
                          Google doc template
                        </a>.
                      </p>
                    </div>
                    <NanceProvider apiUrl={NANCE_API_URL}>
                      <ProposalEditor />
                    </NanceProvider>
                  </Tab.Panel>
                  <Tab.Panel>
                    <div className="mb-8">
                      <p className="text-gray-300">
                        What have you done to accelerate the impact of MoonDAO's mission? Submit your non-project work and accomplishments, even if not tied directly to MoonDAO, to earn ETH financial rewards and vMOONEY voting power. If it helps advance our mission and build a multiplanetary future, it counts! Please refer to {' '}
                        <a href="https://docs.moondao.com/Reference/Nested-Docs/Community-Rewards" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noreferrer">
                          our documentation
                        </a>
                        {' '}for more details. 
                      </p>
                    </div>
                    <ContributionEditor />
                  </Tab.Panel>
                </Tab.Panels>
              </Tab.Group>
            </div>
          </ContentLayout>
          <NoticeFooter />
        </Container>
      </section>
    </>
  );
};

export default SubmissionPage;
