// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tables/JobBoardTable.sol";
import "../src/tables/MarketplaceTable.sol";

// Re-inserts records that failed in MigrateTableData.s.sol due to apostrophes
// in descriptions breaking SQLHelpers.quote(). Single quotes are doubled here.

contract MigrateTableDataFix is Script {
    address constant NEW_JOB_BOARD   = 0x2113341dEc8a0fB9883Ad494C589d5cdefDDBc1b;
    address constant NEW_MARKETPLACE = 0xF0AeE0c837943fa1919538B12b5d9AE11C5EED05;

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPk);

        JobBoardTable jobs = JobBoardTable(NEW_JOB_BOARD);
        MarketplaceTable market = MarketplaceTable(NEW_MARKETPLACE);

        // ── Missing Jobs ──────────────────────────────────────────────────────

        // "We're" → "We''re", "you'd" etc
        jobs.insertIntoTable(
            "Full Stack Smart Contract Engineer",
            "We''re looking for full-stack engineers that are proficient with Solidity and smart contracts, and have some familiarity with DAOs. Ideal candidates have strong relevant professional or project work.\n\nYou would work closely with the founder and tackle new problems in DAOs, innovating on the frontiers of DAO governance, incentives, and finance.\n\nSend an email to pablo@moondao.com with your resume and why you would be an amazing fit for supporting MoonDAO.",
            0, "", "", 1830240000, 1773432256, "mailto:pablo@moondao.com"
        );

        // "you'll" → "you''ll"
        jobs.insertIntoTable(
            "2025 Fellowship Program- Applications Open",
            "Applications for our 2025 fellowship cohort are now open! Are you passionate about creating a sustainable and peaceful lunar future? Join our global fellowship program and contribute to groundbreaking research! As an Open Lunar fellow, you''ll develop innovative lunar research projects while collaborating with leading experts in the space community. We welcome diverse backgrounds and unconventional thinkers. Learn more!",
            9, "", "", 1733983200, 1731449654, "https://www.openlunar.org/blog/2025-fellowship"
        );

        // "LifeShip's" → "LifeShip''s"
        jobs.insertIntoTable(
            "Launch the LifeShip DAO",
            "LifeShip is building towards the launch of a DAO. Get in touch if you want to be one of the early members. We don''t have paid positions at the moment. Compensation would be in tokens in the launch. LifeShip is a space society to preserve Earth and spread life to the stars. LifeShip''s initial missions are monuments on the Moon with a backup of Earth. The vision builds towards a temple on the Moon and communities across Earth and space.",
            2, "", "", 1733983200, 1731449654, "mailto:connect@lifeship.com"
        );

        // "LifeShip's" → "LifeShip''s"
        jobs.insertIntoTable(
            "BD / Sales / Affiliates at LifeShip",
            "LifeShip is looking for passionate individuals to drive business development, product sales, and commission-based B2B partnerships for our space-as-a-service offerings. LifeShip''s is launching a series of monuments to the Moon as backups of Earths biodiversity, culture, and legacy. LifeShip has consumer products for people to send DNA, art, ashes, and more to the Moon. LifeShip has B2B partnerships with organizations wanting to send content to the Moon. Compensation in commission and equity.",
            2, "", "", 1733983200, 1731449654, "mailto:jobs@lifeship.com"
        );

        // "You'll" → "You''ll"
        jobs.insertIntoTable(
            "Research Fellow ",
            "Time Commitment & Compensation\nCommitment: Up to 8 hours per week for 58 months (starting in January), depending on scope. \n\nCompensation: USD $35/hour\n\nLocation: Flexible and remote (Open Lunar operates globally; meetings often scheduled in Eastern Time Zone)\n\nWhat Fellows Do\nResearch & Analysis\nInvestigate emerging ideas for peaceful lunar development\n\nDraft background papers, reports, and articles\n\nDevelop annotated bibliographies and reading lists\n\nSupport research organization and synthesis\n\nCollaboration\nParticipate in weekly fellowship calls with peers and staff\n\nPresent findings at research showcases and conferences\n\nEngage with diverse stakeholders and incorporate feedback\n\nDeliverables\nClear, concise outputs accessible to broad audiences\n\nProvocative insights that drive new thinking in lunar governance\n\nFinal research presented as a published report, white paper, and community showcase\n\n\nWhat You''ll Gain\nLead a research project with an or",
            9, "", "", 1760065200, 1757336731, "https://www.openlunar.org/research-fellowship"
        );

        // ── Missing Marketplace ───────────────────────────────────────────────

        // "that's" → "that''s"
        market.insertIntoTable(
            "MoonDAO Logo T-Shirt",
            "Show your pride in the Internet''s Space Program with this exclusive MoonDAO logo t-shirt. Perfect for space enthusiasts and DAO pioneers alike, this shirt represents the future of decentralized space exploration. Join the movement that''s taking humanity beyond Earth--one mission at a time!",
            "ipfs://QmTuBQJNYAdBZNTf8oXxskYSBYRACFah9Jpkf2KeYyG1BH",
            0, "20", "USDC", 0, 0, 1736345180, "", "", "true"
        );

        // "you'll" → "you''ll"
        market.insertIntoTable(
            "Send a custom plaque to the Moon with your Art",
            "Send your photo or artwork to the Moon with LifeShip, creating a unique and lasting lunar legacy! Your art will be UV printed in full color on a custom 1x1-inch aluminum layer and permanently preserved on the lunar surface. You''ll receive two copies to keep on Earth, while one is sent to the Moon, allowing your vision to inspire future generations. Optional archival-grade Nickel NanoFiche or Ceramic for the highest resolution and durability are an added cost. Share your art with the universe!",
            "ipfs://QmY2iMh83VHGPCG6PDbAweZdYG7yYwTDFPkupH8bjyo6ZL",
            2, "4200", "USDC", 0, 0, 1731449654, "", "", "true"
        );

        // "We're" → "We''re"
        market.insertIntoTable(
            "Cybernetics Engineering / Prototyping  Consultation",
            "Are you interested in designing or commissioning a custom cybernetic implant?  Do you want expert help with the process of developing, funding, and operating a subdermal device? Book a 1 hour video consultation  and up an hour of background research with the Symbiont Labs team to support your needs. We''re open to any project and budget but it all starts with a call.",
            "ipfs://QmVsv1UZWq8sbBa5LL8swaSBM8QvPSivtuweXhufutDyKW",
            11, "199", "USDC", 0, 0, 1733439843, "", "", "false"
        );

        // "IT'S" → "IT''S", "can't" → "can''t"
        string memory newWorldsDesc = "IT''S BACK!\n\nThe EarthLight Foundation is back in Houston this October.  Join us October 24-25 at Space Center Houston for New Worlds, \"the TED Talks of Space\", and the Space Cowboy Ball, \"A Costume Party on the Moon\".\n\nCheck out the line-up and details at www.newworlds.org.  The MoonDAO community showed up in force last year, and we can''t wait to see you all again! (Pablo danced, we saw it with our own eyes.)";
        market.insertIntoTable("Ticket to New Worlds & Space Cowboy Ball | Oct 24-25, 2025 (ETH)",  newWorldsDesc, "ipfs://QmWLgoGz9VzpDX35cRyYx9Fbet2n6K2xQaAu9EVVtUB49u", 1, ".24",     "ETH",    1751342400, 1754020800, 1751335284, "", "", "false");
        market.insertIntoTable("Ticket to New Worlds & Space Cowboy Ball | Oct 24-25, 2025 (USDC)", newWorldsDesc, "ipfs://QmWLgoGz9VzpDX35cRyYx9Fbet2n6K2xQaAu9EVVtUB49u", 1, "600",    "USDC",   1751342400, 1754020800, 1751335418, "", "", "false");
        market.insertIntoTable("Tickets to New Worlds & Space Cowboy Ball | Oct 24-25, 2025 (MOONEY)", newWorldsDesc, "ipfs://QmWLgoGz9VzpDX35cRyYx9Fbet2n6K2xQaAu9EVVtUB49u", 1, "2000000", "MOONEY", 1751342400, 1754020800, 1751335806, "", "", "false");

        // "you'll" → "you''ll", "you've" etc
        market.insertIntoTable(
            "SpaceKind16 Training- Wed Sept 17, 5pm PT - Wed Nov 5, 2025",
            "Join Loretta Hidalgo Whitesides on an 8-week Hero''s Journey to help you take on the next level of your life. Level up your confidence, peace, teamwork, relationships, and joy. Be the person you have always wanted to be. It doesn''t start when you get to space, it starts right here. Greatness doesn''t come from accomplishment alone, come learn the art of having a great life and your future will be magical where ever the universe takes you. \n\nRegistrations close Wednesday Sept 17, 12 noon Pacific so I have time to get you the zoom link before class starts at 5pm Pacific!\n\nZoom meet-ups run 5:00-6:15 pm Pacific every Wednesday. We will read \"The New Right Stuff: Using Space to Bring out the Best in You\" and have challenges to work on between sessions. \n\nGo to www.spacekind.org for a full course description",
            "ipfs://QmU9QfGPdDk6hAsJES53WTVLKvJa4f2DUMH2KHmZ1XtCML",
            19, ".11", "ETH", 0, 0, 1757904583, "", "", "false"
        );

        vm.stopBroadcast();
        console.log("Fix migration complete.");
    }
}
