// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILMSRMarketMaker} from "../../src/deprize/interfaces/ILMSRMarketMaker.sol";
import {IWETH} from "../../src/deprize/interfaces/IWETH.sol";
import "base/Config.sol";

/// @title DePrizeRolesSweep
/// @notice Prints the Zodiac Roles v2 configuration for a keeper that can only
///         withdraw DePrize market fees and send that WETH to the treasury,
///         and the weekly calls that keeper would send. Nothing here is
///         broadcast. The executive branch reviews this config and enables
///         the module itself. That config is the security surface.
///
///         The transfer role allows any amount, so the keeper can move WETH
///         the Safe already holds, not only a fresh withdrawFees balance.
///         That WETH still arrives at the treasury. The keeper key holds gas.
///
/// Env (all optional for the printout; markets are read when set):
///   DEPRIZE_ROLES     Roles modifier the Safe will own
///   DEPRIZE_KEEPER    keeper address that receives the role
///   DEPRIZE_MARKETS   comma-separated LMSR addresses, no spaces
///   DEPRIZE_SWEEP_FLOOR  wei; default 0.002 ether
contract DePrizeRolesSweep is Script, Config {
    /// @notice MoonDAO treasury on Arbitrum. The only allowed WETH recipient.
    address public constant TREASURY = 0xAF26a002d716508b7e375f1f620338442F5470c0;

    /// @notice Stable role id. `assignRoles` takes this key, not a uint16.
    bytes32 public constant ROLE_KEY = keccak256("deprize.feeSweep");

    /// @dev Zodiac Roles v2 `ConditionFlat`. `paramType` is `AbiType`,
    ///      `operator` is `Operator` (EqualTo = 16, Matches = 5, Calldata = 5,
    ///      Static = 1). A static EqualTo compares `abi.encode` of the value.
    struct ConditionFlat {
        uint8 parent;
        uint8 paramType;
        uint8 operator;
        bytes compValue;
    }

    struct RoleCalls {
        bytes scopeMarket;
        bytes allowWithdrawFees;
        bytes scopeWeth;
        bytes scopeTransfer;
        bytes assignKeeper;
    }

    function transferConditions(address treasury) public pure returns (ConditionFlat[] memory conditions) {
        conditions = new ConditionFlat[](2);
        // Root: the calldata is a match of the function's parameters.
        // Trailing unrestricted parameters are omitted; Roles treats them as Pass.
        conditions[0] = ConditionFlat({parent: 0, paramType: 5, operator: 5, compValue: ""});
        // Parameter 0 of transfer(address,uint256) equals the treasury.
        conditions[1] = ConditionFlat({parent: 0, paramType: 1, operator: 16, compValue: abi.encode(treasury)});
    }

    /// @notice Calls the Safe sends to the Roles modifier after the module is enabled.
    ///         One `scopeMarket` / `allowWithdrawFees` pair per market. A new market
    ///         is added in the same executive-branch batch as `setMarket`.
    function roleCalls(address, address keeper, address market, address weth)
        public
        pure
        returns (RoleCalls memory c)
    {
        c.scopeMarket = abi.encodeWithSignature("scopeTarget(bytes32,address)", ROLE_KEY, market);
        c.allowWithdrawFees = abi.encodeWithSignature(
            "allowFunction(bytes32,address,bytes4,uint8)", ROLE_KEY, market, ILMSRMarketMaker.withdrawFees.selector, uint8(0)
        );
        c.scopeWeth = abi.encodeWithSignature("scopeTarget(bytes32,address)", ROLE_KEY, weth);
        c.scopeTransfer = abi.encodeWithSignature(
            "scopeFunction(bytes32,address,bytes4,(uint8,uint8,uint8,bytes)[],uint8)",
            ROLE_KEY,
            weth,
            IERC20.transfer.selector,
            transferConditions(TREASURY),
            uint8(0)
        );
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = ROLE_KEY;
        bool[] memory memberOf = new bool[](1);
        memberOf[0] = true;
        c.assignKeeper = abi.encodeWithSignature("assignRoles(address,bytes32[],bool[])", keeper, keys, memberOf);
    }

    /// @notice The two calls the keeper sends through `execTransactionWithRole`.
    ///         `amount` is the market's standalone WETH, which is the accrued fee.
    function keeperCalls(address, address market, address weth, uint256 amount)
        public
        pure
        returns (bytes memory withdrawCall, bytes memory transferCall)
    {
        withdrawCall = abi.encodeWithSignature(
            "execTransactionWithRole(address,uint256,bytes,uint8,bytes32,bool)",
            market,
            0,
            abi.encodeCall(ILMSRMarketMaker.withdrawFees, ()),
            uint8(0),
            ROLE_KEY,
            true
        );
        transferCall = abi.encodeWithSignature(
            "execTransactionWithRole(address,uint256,bytes,uint8,bytes32,bool)",
            weth,
            0,
            abi.encodeCall(IERC20.transfer, (TREASURY, amount)),
            uint8(0),
            ROLE_KEY,
            true
        );
    }

    function run() external {
        address roles = vm.envOr("DEPRIZE_ROLES", address(0));
        address keeper = vm.envOr("DEPRIZE_KEEPER", address(0));
        uint256 floor = vm.envOr("DEPRIZE_SWEEP_FLOOR", uint256(0.002 ether));
        (address weth,) = requireDePrizeCollateral(block.chainid);

        console.log("=== DePrize Roles keeper (review, do not broadcast from this script) ===");
        console.log("treasury", TREASURY);
        console.log("role key");
        console.logBytes32(ROLE_KEY);
        console.log("WETH", weth);
        console.log("floor wei", floor);
        if (roles != address(0)) {
            console.log("Roles modifier", roles);
            console.log("Safe enableModule calldata:");
            console.logBytes(abi.encodeWithSignature("enableModule(address)", roles));
        } else {
            console.log("DEPRIZE_ROLES unset. Deploy and enable the Roles modifier on the executive branch first.");
        }

        address[] memory markets = _markets();
        if (keeper == address(0) || markets.length == 0) {
            console.log("Set DEPRIZE_KEEPER and DEPRIZE_MARKETS to print the role and the weekly calls.");
            return;
        }

        for (uint256 i; i < markets.length; i++) {
            RoleCalls memory c = roleCalls(roles, keeper, markets[i], weth);
            console.log("--- market", markets[i]);
            console.log("scopeTarget market");
            console.logBytes(c.scopeMarket);
            console.log("allowFunction withdrawFees");
            console.logBytes(c.allowWithdrawFees);
            if (i == 0) {
                console.log("scopeTarget WETH");
                console.logBytes(c.scopeWeth);
                console.log("scopeFunction WETH.transfer treasury");
                console.logBytes(c.scopeTransfer);
                console.log("assignRoles keeper", keeper);
                console.logBytes(c.assignKeeper);
            }
            uint256 accrued = IWETH(weth).balanceOf(markets[i]);
            console.log("standalone WETH", accrued);
            if (accrued <= floor) {
                console.log("below floor; keeper skips this market");
                continue;
            }
            (bytes memory withdrawCall, bytes memory transferCall) = keeperCalls(roles, markets[i], weth, accrued);
            console.log("keeper withdrawFees");
            console.logBytes(withdrawCall);
            console.log("keeper WETH.transfer");
            console.logBytes(transferCall);
        }
    }

    function _markets() internal returns (address[] memory markets) {
        string memory csv = vm.envOr("DEPRIZE_MARKETS", string(""));
        bytes memory b = bytes(csv);
        if (b.length == 0) return new address[](0);
        uint256 n = 1;
        for (uint256 i; i < b.length; i++) {
            if (b[i] == ",") n++;
        }
        markets = new address[](n);
        uint256 start;
        uint256 idx;
        for (uint256 i; i <= b.length; i++) {
            if (i == b.length || b[i] == ",") {
                markets[idx++] = vm.parseAddress(_slice(b, start, i));
                start = i + 1;
            }
        }
    }

    function _slice(bytes memory b, uint256 start, uint256 end) internal pure returns (string memory) {
        bytes memory out = new bytes(end - start);
        for (uint256 i; i < out.length; i++) {
            out[i] = b[start + i];
        }
        return string(out);
    }
}
