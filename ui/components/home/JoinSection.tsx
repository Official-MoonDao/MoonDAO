import Tier from "../onboarding/Tier";
import { useState, useEffect } from 'react'; // import any necessary hooks

const YourComponent = () => {
  // Initialize states like `citizenBalance`, `selectedChain`, `address`, `sdk`, etc.
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedApplyType, setSelectedApplyType] = useState(null);
  const [applyModalEnabled, setApplyModalEnabled] = useState(false);
  const citizenBalance = 0; // Replace with actual logic or state

  const selectedChain = { slug: "chainName" }; // Replace with your chain logic
  const address = "userAddress"; // Replace with actual user address logic
  const sdk = {}; // Replace with SDK logic

  const CITIZEN_WHITELIST_ADDRESSES = { "chainName": "contractAddress" }; // Replace with actual contract addresses
  const TEAM_WHITELIST_ADDRESSES = { "chainName": "contractAddress" }; // Replace with actual contract addresses

  return (
    <div className="mb-10 flex flex-col gap-10">
      <Tier
        price={0.0111}
        label="Become a Citizen"
        description="Citizens are the trailblazers supporting the creation of off-world settlements. Whether you're already part of a team or seeking to join one, everyone has a crucial role to play in this mission."
        points={[
          'Unique Identity: Create a personalized, AI-generated passport image representing your on-chain identity.',
          'Professional Networking: Connect with top space startups, non-profits, and ambitious teams.',
          'Career Advancement: Access jobs, gigs, hackathons, and more; building on-chain credentials to showcase your experience.',
          'Early Project Access: Engage in space projects, earn money, and advance your career.',
        ]}
        buttoncta="Become a Citizen"
        onClick={async () => {
          try {
            const citizenWhitelistContract = await sdk?.getContract(
              CITIZEN_WHITELIST_ADDRESSES[selectedChain.slug]
            );
            const isWhitelisted = await citizenWhitelistContract?.call(
              'isWhitelisted',
              [address]
            );
            if (isWhitelisted) {
              setSelectedTier('citizen');
            } else {
              setSelectedApplyType('citizen');
              setApplyModalEnabled(true);
            }
          } catch (error) {
            console.error("Error in citizen onClick:", error);
          }
        }}
        hasCitizen={+citizenBalance > 0}
        type="citizen"
      />
      <Tier
        price={0.0333}
        label="Create a Team"
        description="Teams are driving innovation and tackling ambitious space challenges together. From non-profits to startups and university teams, every group has something to contribute to our multiplanetary future. Be a part of Team Space."
        points={[
          'Funding Access: Obtain seed funding from MoonDAO for your bold projects and initiatives.',
          'Professional Network: Hire top talent including full-time roles or posting bounties, and connect with other cutting-edge organizations.',
          'Marketplace Listing: Sell products and services in a dedicated space marketplace, whether payload space or satellite imagery.',
          'Capital Raising Tools: Leverage new tools to raise capital or solicit donations from a global network of space enthusiasts.',
          'Onchain Tools: Utilize advanced and secure onchain tools to manage your organization and interface with smart contracts.',
        ]}
        buttoncta="Create a Team"
        onClick={async () => {
          try {
            const teamWhitelistContract = await sdk?.getContract(
              TEAM_WHITELIST_ADDRESSES[selectedChain.slug]
            );
            const isWhitelisted = await teamWhitelistContract?.call(
              'isWhitelisted',
              [address]
            );
            if (isWhitelisted) {
              setSelectedTier('team');
            } else {
              setSelectedApplyType('team');
              setApplyModalEnabled(true);
            }
          } catch (error) {
            console.error("Error in team onClick:", error);
          }
        }}
        type="team"
      />
    </div>
  );
};

export default YourComponent;