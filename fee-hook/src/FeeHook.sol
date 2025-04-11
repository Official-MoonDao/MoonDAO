// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {StateView} from "v4-periphery/src/lens/StateView.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {PositionManager} from "v4-periphery/src/PositionManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta } from "v4-core/src/types/BalanceDelta.sol";
import { OApp, Origin, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";


interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}


contract FeeHook is BaseHook, OApp  {

    using PoolIdLibrary for PoolKey;
    using OptionsBuilder for bytes;
    using StateLibrary for IPoolManager;

    mapping(address => uint256) public totalWithdrawnPerUser;
    uint256 public totalWithdrawn;
    uint256 public totalReceived;
    mapping(PoolId => uint256) public uncollectedFees;
    mapping(PoolId => uint256) public TOKEN_ID;
    bytes32[] public poolIds;
    bytes32[] public transferredPoolIds;

    IPositionManager posm;
    // FIXME increase this
    uint256 public MIN_WITHDRAW = 0.000001 ether;
    uint256 destinationChainId;
    uint16 destinationEid; // LayerZero endpoint ID for the destination chain
    address public vMooneyAddress;



    constructor(address owner, IPoolManager _poolManager, IPositionManager _posm, address _lzEndpoint, uint256 _destinationChainId, uint16 _destinationEid, address _vMooneyAddress) BaseHook(_poolManager) OApp(_lzEndpoint, owner) Ownable(owner) {
        posm = _posm;
        destinationChainId = _destinationChainId;
        destinationEid = _destinationEid;
        vMooneyAddress = _vMooneyAddress;
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

    // -----------------------------------------------
    // NOTE: see IHooks.sol for function documentation
    // -----------------------------------------------
    function sendCrossChain(
        bytes memory payload,
        bytes memory options,
        uint256 messageFee,
        address refundAddress
    ) external payable {
        _lzSend(
            destinationEid,
            payload,
            options,
            MessagingFee(messageFee, 0),
            payable(refundAddress)
        );
    }


    function _afterSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata _params, BalanceDelta _delta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        uint256 feeAmount = 0;
        PoolId poolId = key.toId();
        if (_params.zeroForOne && _params.amountSpecified < 0) {
            feeAmount = uint256(-_params.amountSpecified) * uint256(key.fee) / 1e6;
            uncollectedFees[poolId] += feeAmount;
        }
        if (uncollectedFees[poolId] >= MIN_WITHDRAW) {
            bytes memory actions = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));
            bytes[] memory params = new bytes[](2);
            uint256 tokenId = TOKEN_ID[poolId];
            params[0] = abi.encode(tokenId, 0, 0, 0, bytes(""));
            params[1] = abi.encode(key.currency0, key.currency1, address(this));

            posm.modifyLiquiditiesWithoutUnlock(
                actions, params
            );

            if (block.chainid != destinationChainId) {
                bytes memory payload = abi.encode();
                // FIXME tune this value, could push it lower
                uint128 messageFee = 3_000_000_000_000_000; // 3e15 wei
                                   //9_999_999_999_999_999
                uint128 GAS_LIMIT = 500000;
                uint128 VALUE = uint128(address(this).balance); // 1e15 wei
                bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, VALUE - messageFee);

                // ZOMG
                FeeHook(payable(address(this))).sendCrossChain{value: VALUE}(
                    payload,
                    options,
                    VALUE,
                    address(this)
                );
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
        if (TOKEN_ID[poolId] == 0) {
            TOKEN_ID[poolId] = posm.nextTokenId() - 1;
            poolIds.push(PoolId.unwrap(poolId));
        }
        return BaseHook.beforeAddLiquidity.selector;
    }

    function transferPosition(
        address to,
        bytes32 poolId) external onlyOwner
    {
        PoolId id = PoolId.wrap(poolId);
        uint256 tokenId = TOKEN_ID[id];
        require(tokenId != 0, "Token ID not found");
        transferredPoolIds.push(poolId);
        PositionManager(payable(address(posm))).safeTransferFrom(address(this), to, tokenId, "");
    }


    function withdrawFees() external {
        if (block.chainid != destinationChainId) {
            revert("Not on destination chain. Cannot withdraw fees");
        }
        uint256 totalSupply = IERC20(vMooneyAddress).totalSupply();
        require(totalSupply > 0, "No vMooney supply");
        uint256 userBalance = IERC20(vMooneyAddress).balanceOf(msg.sender);
        uint256 userProportion = userBalance * 1e18 / totalSupply; // Multiply by 1e18 to preserve precision
        //uint256 contractETHBalance = address(this).balance;
        uint256 allocated = (userProportion * totalReceived) / 1e18; // Divide by 1e18 to normalize
        uint256 withdrawnByUser = totalWithdrawnPerUser[msg.sender];
        uint256 withdrawable = allocated - withdrawnByUser;
        require(allocated > 0, "Nothing to withdraw");
        require(withdrawable > 0, "Nothing to withdraw");

        totalWithdrawnPerUser[msg.sender] += withdrawable;
        totalWithdrawn += withdrawable;
        transferETH(msg.sender, withdrawable);
    }

    function transferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    function setMinWithdraw(uint256 _minWithdraw) external onlyOwner {
        MIN_WITHDRAW = _minWithdraw;
    }

    function setvMooneyAddress(address _vMooneyAddress) external onlyOwner {
        vMooneyAddress = _vMooneyAddress;
    }

    receive() external payable {
        totalReceived += msg.value;
    }

    fallback() external payable {
        totalReceived += msg.value;
    }

    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata payload,
        address,  // Executor address as specified by the OApp.
        bytes calldata  // Any extra data or options to trigger on receipt.
    ) internal override {
        totalReceived += msg.value;
    }

}
