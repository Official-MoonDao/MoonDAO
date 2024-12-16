// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IJBController.sol";

contract JBSANProjectCreator is Ownable {
    IJBController private jbController;

    constructor(address _jbController) Ownable(msg.sender) {
        jbController = IJBController(_jbController);
    }

    function setJBController(address _jbController) external onlyOwner {
        jbController = IJBController(_jbController);
    }

    function createTeam(uint256 teamId,address _owner,
    JBProjectMetadata calldata _projectMetadata,
    JBFundingCycleData calldata _data,
    JBFundingCycleMetadata calldata _metadata,
    uint256 _mustStartAtOrAfter,
    JBGroupedSplits[] memory _groupedSplits,
    JBFundAccessConstraints[] memory _fundAccessConstraints,
    IJBPaymentTerminal[] memory _terminals,
    string calldata _memo) external {


        
jbController.launchProjectFor(
    _owner,
    _projectMetadata,
    _data,
    _metadata,
    _mustStartAtOrAfter,
    _groupedSplits,
    _fundAccessConstraints,
    _terminals,
    _memo
);
    }
}
