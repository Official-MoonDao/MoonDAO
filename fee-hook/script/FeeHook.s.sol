// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";

import {Constants} from "./base/Constants.sol";
import {FeeHook} from "../src/FeeHook.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

/// @notice Mines the address and deploys the Counter.sol Hook contract
contract FeeHookScript is Script, Constants {
    function setUp() public {}

    function run() public {
        // hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(
            Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);
        address lzEndpoint;
        address poolManagerAddress;
        address posmAddress;
        address vMooneyAddress = 0xB255c74F8576f18357cE6184DA033c6d93C71899;
        uint16 eid;
        // Sepolia for testnets, arbitrum for mainnet
        uint256 DESTINATION_CHAIN_ID = 42161;
        uint16 DESTINATION_EID = 30110;
        // Addresses from https://docs.uniswap.org/contracts/v4/deployments
        if(block.chainid == 1) { //mainnet
            lzEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;
            poolManagerAddress = 0x000000000004444c5dc75cB358380D2e3dE08A90;
            posmAddress = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
            eid = 30101;
        } else if (block.chainid == 42161) { //arbitrum
            lzEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;
            poolManagerAddress = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
            posmAddress = 0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869;
            eid = 30110;
        } else if (block.chainid == 8453) { //base
            lzEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;
            poolManagerAddress = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
            posmAddress = 0x7C5f5A4bBd8fD63184577525326123B519429bDc;
            eid = 30184;
        } else if (block.chainid == 421614) { //arb-sep
            lzEndpoint = 0x6EDCE65403992e310A62460808c4b910D972f10f;
            poolManagerAddress = 0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317;
            posmAddress = 0xAc631556d3d4019C95769033B5E719dD77124BAc;
            vMooneyAddress = 0xA4F6A4B135b9AF7909442A7a3bF7797b61e609b1;
            DESTINATION_CHAIN_ID = 11155111;
            DESTINATION_EID = 40161;
            eid = 40231;
        } else if (block.chainid == 11155111) { //sep
            lzEndpoint = 0x6EDCE65403992e310A62460808c4b910D972f10f;
            poolManagerAddress = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
            posmAddress = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
            vMooneyAddress = 0xA4F6A4B135b9AF7909442A7a3bF7797b61e609b1;
            DESTINATION_CHAIN_ID = 11155111;
            DESTINATION_EID = 40161;
            eid = 40161;
        } else if (block.chainid == 1301) { // unichain sepolia
            lzEndpoint = 0xb8815f3f882614048CbE201a67eF9c6F10fe5035;
            poolManagerAddress = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
            posmAddress = 0xf969Aee60879C54bAAed9F3eD26147Db216Fd664;
            // FIXME this address doesn't point to anything
            vMooneyAddress = 0xA4F6A4B135b9AF7909442A7a3bF7797b61e609b1;
            DESTINATION_CHAIN_ID = 11155111;
            DESTINATION_EID = 40161;
        }
        // sep feehook: 0x59aF01D17982d2B4b9448ECa29503bE0Ab158aC0
        // arb-sep feehook: 0x75069b3C10D594EFa063f3A21F08Fa5282BE8Ac0

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(deployerAddress, poolManagerAddress, posmAddress, lzEndpoint, DESTINATION_CHAIN_ID, DESTINATION_EID, vMooneyAddress);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(FeeHook).creationCode, constructorArgs);

        // Deploy the hook using CREATE2
        //vm.broadcast();
        FeeHook counter = new FeeHook{salt: salt}(deployerAddress, IPoolManager(poolManagerAddress), IPositionManager(posmAddress), lzEndpoint, DESTINATION_CHAIN_ID, DESTINATION_EID, vMooneyAddress);
        require(address(counter) == hookAddress, "CounterScript: hook address mismatch");
        vm.stopBroadcast();
    }
}
