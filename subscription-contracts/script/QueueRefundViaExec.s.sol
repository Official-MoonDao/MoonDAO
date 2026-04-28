// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/LaunchPadPayHook.sol";
import "../src/LaunchPadApprovalHook.sol";
import {IJBController} from "@nana-core-v5/interfaces/IJBController.sol";
import {IJBRulesetApprovalHook} from "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import {JBRulesetConfig} from "@nana-core-v5/structs/JBRulesetConfig.sol";
import {JBRulesetMetadata} from "@nana-core-v5/structs/JBRulesetMetadata.sol";
import {JBSplitGroup} from "@nana-core-v5/structs/JBSplitGroup.sol";
import {JBFundAccessLimitGroup} from "@nana-core-v5/structs/JBFundAccessLimitGroup.sol";
import {JBCurrencyAmount} from "@nana-core-v5/structs/JBCurrencyAmount.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import "base/Config.sol";

interface IGnosisSafe {
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) external payable returns (bool success);
    function nonce() external view returns (uint256);
}

interface IERC721 {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title QueueRefundViaExec
/// @notice Executes through a 1/1 Gnosis Safe to queue a refund ruleset.
///
/// This script:
///   1. Deploys new PayHook + ApprovalHook with fresh timing (deadline=now, refundPeriod=28d)
///   2. Enables refunds on both hooks
///   3. Executes queueRulesetsOf through the Safe (which owns the JB project NFT)
///
/// Usage:
///   PRIVATE_KEY=0x... forge script script/QueueRefundViaExec.s.sol \
///     --rpc-url https://ethereum-sepolia.publicnode.com --broadcast --via-ir --optimizer-runs 200
contract QueueRefundViaExec is Script, Config {
    // ── Mission 8 constants ──
    uint256 constant PROJECT_ID = 249;
    uint256 constant FUNDING_GOAL = 464655488661361640; // ~0.465 ETH
    address constant TERMINAL = 0x2dB6d704058E552DeFE415753465df8dF0361846;
    address constant SAFE = 0xe774473A2B33Ae71dE01336B7062b4A2ef526286;
    address constant JB_PROJECTS = 0x885f707EFA18D2cb12f05a3a8eBA6B4B26c8c1D4;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        console.log("Deployer:", deployer);
        console.log("Safe:", SAFE);
        console.log("Project ID:", PROJECT_ID);

        vm.startBroadcast(pk);

        // ── 1. Deploy new hooks with fresh timing ──
        uint256 newDeadline = block.timestamp;
        uint256 newRefundPeriod = 28 days;

        LaunchPadPayHook newPayHook = new LaunchPadPayHook(
            FUNDING_GOAL,
            newDeadline,
            newRefundPeriod,
            JB_V5_TERMINAL_STORE,
            JB_V5_RULESETS,
            deployer
        );
        console.log("New PayHook:", address(newPayHook));

        LaunchPadApprovalHook newApprovalHook = new LaunchPadApprovalHook(
            FUNDING_GOAL,
            newDeadline,
            newRefundPeriod,
            JB_V5_TERMINAL_STORE,
            TERMINAL,
            deployer
        );
        console.log("New ApprovalHook:", address(newApprovalHook));

        // ── 2. Enable refunds ──
        // Wire approval hook to the new pay hook so they share refund state.
        newApprovalHook.setPayHook(address(newPayHook));
        newPayHook.enableRefunds(true);
        console.log("Refunds enabled (single flag on pay hook)");

        // ── 3. Build the refund ruleset config ──
        JBCurrencyAmount[] memory surplusAllowances = new JBCurrencyAmount[](1);
        surplusAllowances[0] = JBCurrencyAmount({
            amount: uint224(128_000_000 * 10 ** 18),
            currency: uint32(uint160(JBConstants.NATIVE_TOKEN))
        });

        JBFundAccessLimitGroup[] memory fundAccessLimitGroups = new JBFundAccessLimitGroup[](1);
        fundAccessLimitGroups[0] = JBFundAccessLimitGroup({
            terminal: TERMINAL,
            token: JBConstants.NATIVE_TOKEN,
            payoutLimits: new JBCurrencyAmount[](0),
            surplusAllowances: surplusAllowances
        });

        JBRulesetConfig[] memory rulesetConfigurations = new JBRulesetConfig[](1);
        rulesetConfigurations[0] = JBRulesetConfig({
            mustStartAtOrAfter: 0,
            duration: 0,
            weight: 2_000_000_000_000_000_000_000,
            weightCutPercent: 0,
            approvalHook: IJBRulesetApprovalHook(address(newApprovalHook)),
            metadata: JBRulesetMetadata({
                reservedPercent: 5_000,
                cashOutTaxRate: 0,
                baseCurrency: 61166,
                pausePay: true,
                pauseCreditTransfers: false,
                allowOwnerMinting: false,
                allowSetCustomToken: false,
                allowTerminalMigration: false,
                allowSetTerminals: false,
                allowSetController: false,
                allowAddAccountingContext: false,
                allowAddPriceFeed: false,
                ownerMustSendPayouts: false,
                holdFees: false,
                useTotalSurplusForCashOuts: false,
                useDataHookForPay: true,
                useDataHookForCashOut: true,
                dataHook: address(newPayHook),
                metadata: 0
            }),
            splitGroups: new JBSplitGroup[](0),
            fundAccessLimitGroups: fundAccessLimitGroups
        });

        // ── 4. Encode the queueRulesetsOf call ──
        bytes memory queueCall = abi.encodeWithSelector(
            IJBController.queueRulesetsOf.selector,
            PROJECT_ID,
            rulesetConfigurations,
            "Queuing refund ruleset - manual refund for mission 8"
        );

        // ── 5. Execute through the Safe ──
        // For a 1/1 Safe, the signature is: r = signer address (padded), s = 0, v = 1
        bytes memory signature = abi.encodePacked(
            bytes32(uint256(uint160(deployer))), // r = owner address
            bytes32(0),                          // s = 0
            uint8(1)                             // v = 1 (approved hash)
        );

        console.log("Executing queueRulesetsOf through Safe...");

        bool success = IGnosisSafe(SAFE).execTransaction(
            JB_V5_CONTROLLER,  // to
            0,                 // value
            queueCall,         // data
            0,                 // operation (Call)
            0,                 // safeTxGas
            0,                 // baseGas
            0,                 // gasPrice
            address(0),        // gasToken
            payable(address(0)), // refundReceiver
            signature          // signatures
        );

        require(success, "Safe execTransaction failed");

        vm.stopBroadcast();

        console.log("");
        console.log("=== SUCCESS ===");
        console.log("Refund ruleset queued through Safe!");
        console.log("New PayHook:", address(newPayHook));
        console.log("New ApprovalHook:", address(newApprovalHook));
        console.log("Refund window: now ->", block.timestamp + newRefundPeriod);
        console.log("Contributors can cash out their tokens for a refund.");
    }
}
