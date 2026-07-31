// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import "base/Config.sol";
import {MissionCreator} from "../../src/MissionCreator.sol";
import {MoonDAOTeam} from "../../src/ERC5643.sol";
import {MoonDAOTeamCreator} from "../../src/MoonDAOTeamCreator.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";
import {DePrizeFeeRouter} from "../../src/deprize/DePrizeFeeRouter.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";

/// Minimal ABI-compatible views of the externally-deployed (Solidity 0.5)
/// Gnosis prediction-market stack. Contract-typed params (ConditionalTokens,
/// IERC20, Whitelist) all compile to `address` at the ABI level, so plain
/// `address` here encodes identically to the real functions.
interface ICTFPrepare {
    function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external;
    function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount)
        external
        pure
        returns (bytes32);
}

interface IWETH9Min {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ILMSRFactoryMin {
    function createLMSRWithTWAP(
        address pmSystem,
        address collateralToken,
        bytes32[] calldata conditionIds,
        uint64 fee,
        address whitelist,
        uint256 funding
    ) external returns (address lmsrWithTWAP);
}

interface IOwnableMin {
    function transferOwnership(address newOwner) external;
}

/// @title DePrizeSeedRace
/// @notice Provisions ONE Moon Base Zero tech-tree race end to end on Sepolia,
///         mirroring the exact runbook already proven for DePrize 9
///         (fission surface power): mint a Team NFT per competitor (+ the
///         shared Open Field NFT on first use), create a Juicebox mission
///         for the prize pool, prepare a CTF condition, deploy + fund a
///         fresh LMSRWithTWAP market, hand it to the FeeRouter, register the
///         DePrize, and wire mint/feeRouter.
///
/// Run ONCE PER RACE. All steps happen inside a single broadcast, so a
/// partial on-chain failure reverts the whole run atomically (nothing is
/// half-provisioned) — except the Open Field NFT mint, which is a real
/// separate prior transaction the first time it is needed (see
/// OPEN_FIELD_TEAM_ID below).
///
/// Usage (from subscription-contracts/):
///   export PRIVATE_KEY=0x...
///   export SEPOLIA_RPC_URL=https://...
///   TEAM_NAMES="ICON,Redwire,Astroport Space Technologies,AI SpaceFactory" \
///   QUESTION_ID=0x...02 \
///   OPEN_FIELD_TEAM_ID=999 \
///   forge script script/deprize/DePrizeSeedRace.s.sol \
///     --rpc-url $SEPOLIA_RPC_URL --broadcast --via-ir -vvv
///
/// If OPEN_FIELD_TEAM_ID is unset (0), this run mints a fresh Open Field Team
/// NFT and prints its id — pass that id on every subsequent race's run so the
/// Open Field slot is the SAME NFT everywhere.
///
/// Env vars:
///   TEAM_NAMES            comma-separated competitor org names, in the exact
///                          order the outcome index should follow (2-4 names)
///   QUESTION_ID            bytes32, unique per race — bump for every DePrize
///   OPEN_FIELD_TEAM_ID     0 to mint fresh, else the existing shared id
///   RACE_LABEL             short label used in the mission token name/memo
///   FUNDING_PER_OUTCOME    wei, LMSR bounded-loss liquidity per outcome slot
///                          (default 0.005 ETH — keep small on testnet)
///   SUNSET_DAYS            days until betting sunset (default 365)
///   MISSION_CREATOR        override the fresh Sepolia MissionCreator used
///                          for DePrize 9 (default hardcoded below)
///   DEPRIZE_REGISTRY/DEPRIZE_MINT/DEPRIZE_FEE_ROUTER  override known Sepolia
///                          addresses if redeployed
contract DePrizeSeedRace is Script, Config {
    // Known Sepolia DePrize infra (see docs/DEPRIZE_QA.md).
    address constant DEFAULT_REGISTRY = 0x299F163705AbBFa1A8DE7670F33171730F828F3D;
    address constant DEFAULT_MINT = 0xA6F9632ee9848f7C1f252DA5a1e869aC90E57cc8;
    address constant DEFAULT_FEE_ROUTER = 0xBE8CBC97D4DDeE28B938c0Ed8245f1b5133b783A;
    // Fresh, dedicated MissionCreator used for DePrize 9 — NOT the app-wide
    // production one (kept separate on purpose; see DEPRIZE_QA.md).
    address constant DEFAULT_MISSION_CREATOR = 0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address sender = vm.addr(pk);

        address registry = vm.envOr("DEPRIZE_REGISTRY", DEFAULT_REGISTRY);
        address payable mintAddr = payable(vm.envOr("DEPRIZE_MINT", DEFAULT_MINT));
        address payable feeRouterAddr = payable(vm.envOr("DEPRIZE_FEE_ROUTER", DEFAULT_FEE_ROUTER));
        address missionCreatorAddr = vm.envOr("MISSION_CREATOR", DEFAULT_MISSION_CREATOR);

        string[] memory teamNames = vm.envString("TEAM_NAMES", ",");
        require(teamNames.length >= 2 && teamNames.length <= 4, "TEAM_NAMES: expect 2-4 competitors");

        bytes32 questionId = vm.envBytes32("QUESTION_ID");
        uint256 openFieldTeamId = vm.envOr("OPEN_FIELD_TEAM_ID", uint256(0));
        string memory raceLabel = vm.envOr("RACE_LABEL", string("DePrize race"));
        uint256 fundingPerOutcome = vm.envOr("FUNDING_PER_OUTCOME", uint256(0.005 ether));
        uint256 sunsetDays = vm.envOr("SUNSET_DAYS", uint256(365));

        address weth = WETH_ADDRESSES[SEP];
        address ctf = CONDITIONAL_TOKENS_ADDRESSES[SEP];
        address factory = 0x8787Dc3c2b48b19D3Cbd25226Cd6cEAff3398de1; // LMSRWithTWAPFactory (Sepolia)
        require(weth != address(0) && ctf != address(0), "WETH/CTF not configured");

        uint256 numOutcomes = teamNames.length + 1; // + Open Field slot
        uint256 funding = fundingPerOutcome * numOutcomes;

        console.log("=== DePrizeSeedRace ===");
        console.log("race:        ", raceLabel);
        console.log("competitors: ", teamNames.length);
        console.log("funding (wei):", funding);

        vm.startBroadcast(pk);

        // 1. Team NFTs — one per competitor, sequential ids from whatever the
        // NFT contract's counter is at. Free on Sepolia (pricePerSecond == 0).
        uint256[] memory teamIds = new uint256[](numOutcomes);
        for (uint256 i = 0; i < teamNames.length; i++) {
            teamIds[i] = _createTeam(sender, teamNames[i]);
            console.log("  team:", teamNames[i], teamIds[i]);
        }

        // Open Field: reuse the shared NFT everywhere, mint once on first use.
        if (openFieldTeamId == 0) {
            openFieldTeamId = _createTeam(sender, "Open Field");
            console.log("  Open Field NFT minted fresh, id:", openFieldTeamId);
            console.log("  RECORD this id and pass OPEN_FIELD_TEAM_ID on every other race run.");
        } else {
            console.log("  Open Field NFT reused, id:", openFieldTeamId);
        }
        teamIds[numOutcomes - 1] = openFieldTeamId;

        // 2. Juicebox mission for the prize pool (same registry-aware
        // LaunchPadPayHook path as DePrize 9). Long deadline/refund so the
        // mission never lapses out from under the DePrize's lifecycle.
        MissionCreator missionCreator = MissionCreator(missionCreatorAddr);
        uint256 missionId = missionCreator.createMission(
            0,
            sender,
            "",
            100 ether,
            block.timestamp + 3650 days,
            1 days,
            true,
            string.concat(raceLabel, " Prize"),
            "DPRZ",
            string.concat("DePrize: ", raceLabel)
        );
        uint256 jbProjectId = missionCreator.missionIdToProjectId(missionId);
        console.log("  JB project:", jbProjectId);

        // 3. CTF condition. Oracle = this deployer, matching DePrize 9 (the
        // admin panel derives the oracle role by matching
        // keccak(caller, questionId, numOutcomes) against the conditionId).
        ICTFPrepare(ctf).prepareCondition(sender, questionId, numOutcomes);
        bytes32 conditionId = ICTFPrepare(ctf).getConditionId(sender, questionId, numOutcomes);
        console.log("  conditionId:");
        console.logBytes32(conditionId);

        // 4. Fund + create the LMSR market (1% fee, no whitelist).
        IWETH9Min(weth).deposit{value: funding}();
        IWETH9Min(weth).approve(factory, funding);
        bytes32[] memory conditionIds = new bytes32[](1);
        conditionIds[0] = conditionId;
        address lmsr = ILMSRFactoryMin(factory).createLMSRWithTWAP(
            ctf, weth, conditionIds, 1e16, address(0), funding
        );
        console.log("  LMSR market:", lmsr);

        // Factory leaves the deployer owning the market; hand it to the
        // FeeRouter so pause/close/withdrawFees route through it, same as
        // every other Sepolia DePrize.
        IOwnableMin(lmsr).transferOwnership(feeRouterAddr);

        // 5. Register + open on the 0.8 side.
        uint256 sunset = block.timestamp + sunsetDays * 1 days;
        uint256 deprizeId = IDePrizeRegistry(registry).register(jbProjectId, teamIds, sunset);
        IDePrizeRegistry(registry).setCondition(deprizeId, conditionId);
        IDePrizeRegistry(registry).open(deprizeId);
        console.log("  DePrize id:", deprizeId);

        // 6. Wire the bet router + fee router to the new market. setFeeRouter
        // is a one-time global setting already done for DePrize 9 — not
        // repeated here.
        DePrizeMint(mintAddr).setMarket(deprizeId, lmsr);
        DePrizeFeeRouter(feeRouterAddr).setMarket(deprizeId, lmsr);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Race ready ===");
        console.log("DePrize id:  ", deprizeId);
        console.log("JB project:  ", jbProjectId);
        console.log("LMSR market: ", lmsr);
        console.log("Open Field id:", openFieldTeamId);
        console.log("Team ids (in outcome order, Open Field last):");
        for (uint256 i = 0; i < teamIds.length; i++) {
            console.log("  ", i, teamIds[i]);
        }
        console.log("QUESTION_ID used (record with conditionId for resolution):");
        console.logBytes32(questionId);
        console.log("Next: add this binding to ui/lib/deprize/competitions.ts");
    }

    /// @dev Mint a MoonDAO Team NFT for `creator`, named `name`. No extra
    /// managers/Safe co-owners — these are DePrize competitor placeholders,
    /// not community teams, so a bare 1/1 Safe is enough.
    function _createTeam(address creator, string memory name) internal returns (uint256 teamId) {
        address teamAddress = MOONDAO_TEAM_ADDRESSES[SEP];
        require(teamAddress != address(0), "No Sepolia MoonDAOTeam configured");
        MoonDAOTeam team = MoonDAOTeam(teamAddress);
        MoonDAOTeamCreator teamCreator = MoonDAOTeamCreator(team.moonDaoCreator());

        uint256 price = team.getRenewalPrice(creator, 365 days);

        MoonDAOTeamCreator.HatURIs memory hatURIs =
            MoonDAOTeamCreator.HatURIs({adminHatURI: "", managerHatURI: "", memberHatURI: ""});
        // Coverage build strips optional profile fields via 0001-struct.patch
        // (see CreateTestMissionSepolia.s.sol) — assign only fields present in
        // both the full and patched struct.
        MoonDAOTeamCreator.TeamMetadata memory metadata;
        metadata._view = "";
        metadata.formId = "";

        (teamId,) = teamCreator.createMoonDAOTeam{value: price}(hatURIs, metadata, new address[](0));
    }
}
