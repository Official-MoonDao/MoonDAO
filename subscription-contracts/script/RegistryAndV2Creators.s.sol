// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/*
Deploys the hats-free authorization + projects-as-teams stack:

  1. TeamRoleRegistry        - on-chain roles; falls back to hats for legacy teams
  2. TeamMinterRouter        - allows multiple creators to mint MoonDAOTeam NFTs
  3. ProjectV2               - governance overlay Tableland table (keyed by teamId)
  4. MoonDAOTeamCreatorV2    - hats-free team creator (registry roles)
  5. ProjectTeamCreatorV2    - governance-driven project creator (projects are teams)

Deployer-owned wiring is done here. The following steps must be executed by the
owner of each contract (the DAO Safe) after deploy, e.g. via Safe transactions:

  moonDAOTeam.setMoonDaoCreator(router)          // route minting through the router
  jobBoardTable.setMoonDaoTeam(registry)         // repoint jobs authorization
  marketplaceTable.setMoonDaoTeam(registry)      // repoint marketplace authorization
  missionTable.setMoonDaoTeam(registry)          // repoint mission table authorization
  missionCreator.setMoonDAOTeam(registry)        // repoint launchpad authorization
  teamTableV2.setMoonDaoTeam(registry)           // repoint team-profile authorization
  teamTableV2.setOperator(teamCreatorV2, true)   // allow V2 team inserts (keeps V1 _teamCreatorAddress)
  teamTableV2.setOperator(projectCreatorV2, true)// allow V2 project-team inserts

Repointing is reversible: point back at the MoonDAOTeam address to restore hats-only auth.
TeamTableV2 must support setOperator (redeploy if the live table is still single-creator only).
*/

import "forge-std/Script.sol";
import {TeamRoleRegistry} from "../src/TeamRoleRegistry.sol";
import {TeamMinterRouter} from "../src/TeamMinterRouter.sol";
import {ProjectV2} from "../src/tables/ProjectV2.sol";
import {MoonDAOTeamCreatorV2} from "../src/MoonDAOTeamCreatorV2.sol";
import {ProjectTeamCreatorV2} from "../src/ProjectTeamCreatorV2.sol";

contract RegistryAndV2CreatorsScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address authorizedSignerAddress = vm.envAddress("AUTHORIZED_SIGNER_ADDRESS");

        // Arbitrum mainnet addresses (see ui/const/config.ts)
        address TEAM_ADDRESS = 0xAB2C354eC32880C143e87418f80ACc06334Ff55F;
        address TEAM_TABLE_ADDRESS = 0x36A57e45A1F8e378AA3e35bD8799bBfB5b4C00b3;
        address WHITELIST_ADDRESS = 0x203ca831edec28b7657A022b8aFe5d28b6BE6Eda;
        address GNOSIS_SINGLETON_ADDRESS = 0x3E5c63644E683549055b9Be8653de26E0B4CD36E;
        address GNOSIS_SAFE_PROXY_FACTORY_ADDRESS = 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2;

        vm.startBroadcast(deployerPrivateKey);

        TeamRoleRegistry registry = new TeamRoleRegistry(TEAM_ADDRESS);
        TeamMinterRouter router = new TeamMinterRouter(TEAM_ADDRESS);
        ProjectV2 projectTable = new ProjectV2("PROJECTV2");

        address[] memory authorizedSigners = new address[](1);
        authorizedSigners[0] = authorizedSignerAddress;

        MoonDAOTeamCreatorV2 teamCreator = new MoonDAOTeamCreatorV2(
            TEAM_ADDRESS,
            address(router),
            address(registry),
            GNOSIS_SINGLETON_ADDRESS,
            GNOSIS_SAFE_PROXY_FACTORY_ADDRESS,
            TEAM_TABLE_ADDRESS,
            WHITELIST_ADDRESS,
            authorizedSigners
        );

        ProjectTeamCreatorV2 projectCreator = new ProjectTeamCreatorV2(
            TEAM_ADDRESS,
            address(router),
            address(registry),
            GNOSIS_SINGLETON_ADDRESS,
            GNOSIS_SAFE_PROXY_FACTORY_ADDRESS,
            TEAM_TABLE_ADDRESS,
            address(projectTable)
        );

        // Deployer-owned wiring
        router.setMinter(address(teamCreator), true);
        router.setMinter(address(projectCreator), true);

        registry.setOperator(address(teamCreator), true);
        registry.setOperator(address(projectCreator), true);

        projectTable.setRegistry(address(registry));
        projectTable.setOperator(address(projectCreator), true);

        vm.stopBroadcast();

        console.log("TeamRoleRegistry:", address(registry));
        console.log("TeamMinterRouter:", address(router));
        console.log("ProjectV2 table:", address(projectTable));
        console.log("ProjectV2 tableName:", projectTable.getTableName());
        console.log("MoonDAOTeamCreatorV2:", address(teamCreator));
        console.log("ProjectTeamCreatorV2:", address(projectCreator));
    }
}
