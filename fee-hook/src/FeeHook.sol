// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {PositionManager} from "v4-periphery/src/PositionManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {CurrencyLibrary} from "v4-core/src/types/Currency.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

contract FeeHook is BaseHook, Ownable {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using Strings for uint256;

    mapping(PoolId => uint256) public uncollectedFees; // Uncollected fees for each LP position
    mapping(PoolId => uint256) public poolIdToTokenId; // Token ID for the NFT representing each LP position
    IPositionManager posm;
    uint256 public minWithdraw = 0.01 ether;
    address public vMooneyAddress;
    uint256 public totalReceived;

    // Weekly check-in state
    uint256 public weekStart;
    address[] public checkedIn;
    mapping(address => uint256) public lastCheckIn;
    uint256 constant WEEK = 7 days;

    event CheckedIn(address indexed user, uint256 weekStart);
    event FeesDistributed(uint256 amount);
    event TransferredPosition(address indexed to, bytes32 poolId, uint256 tokenId);
    event CreatedPosition(bytes32 poolId, uint256 tokenId);

    constructor(address owner, IPoolManager _poolManager, IPositionManager _posm, address _vMooneyAddress) BaseHook(_poolManager) Ownable(owner) {
        posm = _posm;
        vMooneyAddress = _vMooneyAddress;
        weekStart = block.timestamp;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function setMinWithdraw(uint256 _minWithdraw) external onlyOwner {
        minWithdraw = _minWithdraw;
    }

    function setvMooneyAddress(address _vMooneyAddress) external onlyOwner {
        vMooneyAddress = _vMooneyAddress;
    }

    function _afterSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata _params, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        PoolId poolId = key.toId();
        if (_params.zeroForOne && _params.amountSpecified < 0) {
            uint256 feeAmount = uint256(-_params.amountSpecified) * uint256(key.fee) / 1e6;
            uncollectedFees[poolId] += feeAmount;
        }
        // Only withraw fees if the amount is above a certain threshold to save on gas
        if (uncollectedFees[poolId] >= minWithdraw) {
            // 1. Collect fees.
            bytes memory actions = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));
            bytes[] memory params = new bytes[](2);
            uint256 tokenId = poolIdToTokenId[poolId];
            params[0] = abi.encode(tokenId, 0, 0, 0, bytes(""));
            params[1] = abi.encode(key.currency0, key.currency1, address(this));
            posm.modifyLiquiditiesWithoutUnlock(
                actions, params
            );
            // Burn non-native tokens by sending them to the dEaD address
            if (CurrencyLibrary.balanceOfSelf(key.currency1) > 0) {
                CurrencyLibrary.transfer(key.currency1, address(0x000000000000000000000000000000000000dEaD), CurrencyLibrary.balanceOfSelf(key.currency1));
            }
            uncollectedFees[poolId] = 0;
        }
        return (BaseHook.afterSwap.selector, 0);
    }

    function _beforeAddLiquidity(
        address,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) internal override returns (bytes4) {
        PoolId poolId = key.toId();
        if (poolIdToTokenId[poolId] == 0) {
            poolIdToTokenId[poolId] = posm.nextTokenId() - 1;
            emit CreatedPosition(PoolId.unwrap(poolId), poolIdToTokenId[poolId]);
        }
        return BaseHook.beforeAddLiquidity.selector;
    }

    // Allows the owner to transfer an LP position to another address
    // in case any manual intervention is needed.
    function transferPosition(
        address to,
        bytes32 poolId) external onlyOwner
    {
        PoolId id = PoolId.wrap(poolId);
        uint256 tokenId = poolIdToTokenId[id];
        require(tokenId != 0, "Token ID not found");
        emit TransferredPosition(to, poolId, tokenId);
        PositionManager(payable(address(posm))).safeTransferFrom(address(this), to, tokenId, "");
    }

    /// @notice Mark the caller as participating in the current week
    function checkIn() external {
        require(IERC20(vMooneyAddress).balanceOf(msg.sender) > 0, "Must hold vMooney to check in");
        if (lastCheckIn[msg.sender] < weekStart) {
            lastCheckIn[msg.sender] = weekStart;
            checkedIn.push(msg.sender);
            emit CheckedIn(msg.sender, weekStart);
        }
    }

    function getCheckedInCount() external view returns (uint256) {
        return checkedIn.length;
    }

    function balanceOf() external view returns (uint256) {
        return address(this).balance;
    }

    function setWeekStart(uint256 newWeekStart) external onlyOwner {
        weekStart = newWeekStart;
    }

    /// @notice Distribute all accrued fees to checked in users
    function distributeFees() external {
        require(block.timestamp >= weekStart + WEEK, "Week not finished");
        uint256 length = checkedIn.length;
        require(length > 0, "No checkins");

        uint256 total;
        for (uint256 i = 0; i < length; i++) {
            total += IERC20(vMooneyAddress).balanceOf(checkedIn[i]);
        }
        require(total > 0, "No balance");

        uint256 fees = address(this).balance;
        uint256 remaining = fees;
        for (uint256 i = 0; i < length; i++) {
            address user = checkedIn[i];
            uint256 bal = IERC20(vMooneyAddress).balanceOf(user);
            uint256 share = (i == length - 1) ? remaining : (fees * bal) / total;
            if (share > 0) transferETH(user, share);
            remaining -= share;
        }

        delete checkedIn;
        weekStart = block.timestamp;
        emit FeesDistributed(fees);
    }

    function estimateFees() external view returns (uint256) {
        uint256 length = checkedIn.length;
        require(length > 0, "No checkins");

        uint256 total;
        for (uint256 i = 0; i < length; i++) {
            total += IERC20(vMooneyAddress).balanceOf(checkedIn[i]);
        }

        uint256 fees = address(this).balance;
        uint256 bal = IERC20(vMooneyAddress).balanceOf(msg.sender);
        if (total == 0 || bal == 0) return 0;
        return (fees * bal) / total;
    }

    function transferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    receive() external payable {
        totalReceived += msg.value;
    }

    fallback() external payable {
        totalReceived += msg.value;
    }

}
