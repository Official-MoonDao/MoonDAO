import React from 'react';
import TabModule from '../layout/tabmodule';
import CitizenTier from '../onboarding/CitizenTier';
import TeamTier from '../onboarding/TeamTier';
import StandardButton from '../layout/StandardButton';

export default function Callout1() {
  const setSelectedTier = (tier: string) => {
    // Implement the logic for setting the selected tier
  };

  const tabs = [
    { label: 'Become a Citizen', content: <CitizenTier setSelectedTier={setSelectedTier} /> },
    { label: 'Create a Team', content: <TeamTier setSelectedTier={setSelectedTier} /> },
  ];

  return (
    <section id="callout1-section" className="bg-dark-warm md:bg-transparent">
      <div
        id="callout1-container"
        className="md:rounded-bl-[5vmax] z-20 relative w-[100%] h-[100%] bg-white mt-[-2vmax] pt-[2vmax] pb-0 lg:pb-10"
      >
        <div
          id="content-container"
          className="compact-lg flex flex-col-reverse justify-end lg:flex-row items-start lg:items-center min-h-[250px] md:min-h-[400px] p-5 pt-10 pb-0 md:p-10 md:pt-10 lg:max-w-[1200px]"
        >
          <div
            id="content"
            className="overflow-visible relative pb-10 md:pb-10 w-[100%]"
          >
            <div className="flex justify-center items-center">
              <p>The Space Acceleration Network is an onchain startup society focused on building a permanent settlement on the Moon and beyond. We aim to connect space visionaries and organizations with the funding, tools, and support needed to turn bold ideas into reality.</p>
              <StandardButton
                backgroundColor="bg-dark-cool"
                textColor="text-white"
                hoverColor="bg-mid-cool"
                borderRadius="rounded-tl-[10px] rounded-[2vmax]"
                link="/get-mooney"
                paddingOnHover="pl-5"
                >
                Unlock Voting Power
              </StandardButton>
            </div>
            <TabModule tabs={tabs} />
          </div>
        </div>
      </div>
    </section>
  );
}
