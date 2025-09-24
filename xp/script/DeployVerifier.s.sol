// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/XPManager.sol";
import "../src/XPOracle.sol";
import "../src/verifiers/HasVotingPowerStaged.sol";
import "../src/verifiers/HasVotedStaged.sol";
import "../src/verifiers/HasCreatedATeam.sol";
import "../src/verifiers/HasContributedStaged.sol";
import "../src/verifiers/HasCompletedCitizenProfile.sol";
import "../src/verifiers/HasJoinedATeam.sol";
import "../src/verifiers/HasSubmittedPRStaged.sol";
import "../src/verifiers/HasSubmittedIssue.sol";
import "../src/verifiers/CitizenReferralsStaged.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployVerifierScript is Script {
    function run() external {
        // Get configuration from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address authorizedSignerAddress = vm.envAddress("HSM_SIGNER_ADDRESS");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        address daoSafeAddress = vm.envAddress("DAO_SAFE_ADDRESS");
        address xpManagerAddress = vm.envAddress("XP_MANAGER_ADDRESS");

        if (oracleAddress == address(0)) {
            revert("No oracle address provided");
        }

        if (authorizedSignerAddress == address(0)) {
            revert("No HSM signer address provided");
        }

        if (daoSafeAddress == address(0)) {
            revert("No DAO safe address provided");
        }

        // Start broadcast
        vm.startBroadcast(deployerPrivateKey);

        CitizenReferralsStaged citizenReferralsVerifier = new CitizenReferralsStaged(oracleAddress);

        citizenReferralsVerifier.setXPManager(xpManagerAddress);

        citizenReferralsVerifier.setAuthorizedSigner(authorizedSignerAddress);
    
        citizenReferralsVerifier.transferOwnership(daoSafeAddress);
        
        vm.stopBroadcast();
    }
}
