// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";

/// @notice Shared configuration between scripts
contract Config is Script {
    using stdJson for string;

    uint256 MAINNET = 1;
    uint256 ARBITRUM = 42161;
    uint256 BASE = 8453;
    uint256 ARB_SEP = 421614;
    uint256 SEP = 11155111;
    uint256 POLYGON = 137;

    mapping(uint256 => address) public LZ_ENDPOINTS;
    mapping(uint256 => address) public POOL_MANAGERS;
    mapping(uint256 => address) public POSITION_MANAGERS;
    mapping(uint256 => address) public V4_ROUTERS;
    mapping(uint256 => address) public VMOONEY_ADDRESSES;
    mapping(uint256 => address) public FEE_HOOK_ADDRESSES;
    mapping(uint256 => address) public TEST_TOKEN_ADDRESSES;
    mapping(uint256 => uint32) public LZ_EIDS;
    mapping(uint256 => address) public CHAINLINK_ROUTERS;
    mapping(uint256 => bytes32) public CHAINLINK_DONS;
    mapping(uint256 => uint64) public CHAINLINK_SUBS;
    mapping(uint256 => uint24) public LP_FEE;

    constructor() {
        string memory ethJson = vm.readFile("../contracts/deployments/ethereum.json");
        string memory arbJson = vm.readFile("../contracts/deployments/arbitrum.json");
        string memory baseJson = vm.readFile("../contracts/deployments/base.json");
        string memory sepJson = vm.readFile("../contracts/deployments/sepolia.json");
        string memory polygonJson = vm.readFile("../contracts/deployments/polygon.json");
        string memory arbSepJson = vm.readFile("../contracts/deployments/arbitrum-sepolia.json");


        // vMOONEY doesn't exist on arbitrum-sepolia
        VMOONEY_ADDRESSES[ARBITRUM] = arbJson.readAddress(".vMOONEYToken");
        VMOONEY_ADDRESSES[BASE] = baseJson.readAddress(".vMOONEYToken");
        VMOONEY_ADDRESSES[MAINNET] = ethJson.readAddress(".vMOONEYToken");
        VMOONEY_ADDRESSES[POLYGON] = polygonJson.readAddress(".vMOONEYToken");
        VMOONEY_ADDRESSES[SEP] = sepJson.readAddress(".vMOONEYToken");


        LP_FEE[SEP] = 500000;
        LP_FEE[ARB_SEP] = 500000;
        LP_FEE[MAINNET] = 10000;
        LP_FEE[ARBITRUM] = 10000;
        LP_FEE[BASE] = 10000;

        // FIXME make subscriptions for each chain
        CHAINLINK_SUBS[ARB_SEP] = 362;
        CHAINLINK_SUBS[SEP] = 4653;

        CHAINLINK_ROUTERS[ARBITRUM] = 0x97083E831F8F0638855e2A515c90EdCF158DF238;
        CHAINLINK_ROUTERS[BASE] = 0xf9B8fc078197181C841c296C876945aaa425B278;
        CHAINLINK_ROUTERS[MAINNET] = 0x65Dcc24F8ff9e51F10DCc7Ed1e4e2A61e6E14bd6;
        CHAINLINK_ROUTERS[POLYGON] = 0xdc2AAF042Aeff2E68B3e8E33F19e4B9fA7C73F10;
        CHAINLINK_ROUTERS[ARB_SEP] = 0x234a5fb5Bd614a7AA2FfAB244D603abFA0Ac5C5C;
        CHAINLINK_ROUTERS[SEP] = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;

        CHAINLINK_DONS[ARBITRUM] = 0x66756e2d617262697472756d2d6d61696e6e65742d3100000000000000000000;
        CHAINLINK_DONS[BASE] = 0x66756e2d626173652d6d61696e6e65742d310000000000000000000000000000;
        CHAINLINK_DONS[MAINNET] = 0x66756e2d657468657265756d2d6d61696e6e65742d3100000000000000000000;
        CHAINLINK_DONS[POLYGON] = 0x66756e2d706f6c79676f6e2d6d61696e6e65742d310000000000000000000000;
        CHAINLINK_DONS[ARB_SEP] = 0x66756e2d617262697472756d2d7365706f6c69612d3100000000000000000000;
        CHAINLINK_DONS[SEP] = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;

        LZ_ENDPOINTS[MAINNET] = 0x1a44076050125825900e736c501f859c50fE728c;
        LZ_ENDPOINTS[ARBITRUM] = 0x1a44076050125825900e736c501f859c50fE728c;
        LZ_ENDPOINTS[BASE] = 0x1a44076050125825900e736c501f859c50fE728c;
        LZ_ENDPOINTS[ARB_SEP] = 0x6EDCE65403992e310A62460808c4b910D972f10f;
        LZ_ENDPOINTS[SEP] = 0x6EDCE65403992e310A62460808c4b910D972f10f;

        POOL_MANAGERS[MAINNET] = 0x000000000004444c5dc75cB358380D2e3dE08A90;
        POOL_MANAGERS[ARBITRUM] = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
        POOL_MANAGERS[BASE] = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
        POOL_MANAGERS[ARB_SEP] = 0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317;
        POOL_MANAGERS[SEP] = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

        POSITION_MANAGERS[MAINNET] = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
        POSITION_MANAGERS[ARBITRUM] = 0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869;
        POSITION_MANAGERS[BASE] = 0x7C5f5A4bBd8fD63184577525326123B519429bDc;
        POSITION_MANAGERS[ARB_SEP] = 0xAc631556d3d4019C95769033B5E719dD77124BAc;
        POSITION_MANAGERS[SEP] = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;

        V4_ROUTERS[MAINNET] = 0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af;
        V4_ROUTERS[ARBITRUM] = 0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3;
        V4_ROUTERS[BASE] = 0x6fF5693b99212Da76ad316178A184AB56D299b43;
        V4_ROUTERS[ARB_SEP] = 0xeFd1D4bD4cf1e86Da286BB4CB1B8BcED9C10BA47;
        V4_ROUTERS[SEP] = 0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b;

        FEE_HOOK_ADDRESSES[ARB_SEP] = 0xdB6D4EDbe5b6954744f4dB552502b0b035A80844;
        FEE_HOOK_ADDRESSES[SEP] = 0xAe019281733Bb13A09A67e5c7Ede189035eD8844;

        TEST_TOKEN_ADDRESSES[ARB_SEP] = 0xb3BcE60D10bcD58871FB94B4104500992aC15120;
        TEST_TOKEN_ADDRESSES[SEP] = 0xb3BcE60D10bcD58871FB94B4104500992aC15120;

        LZ_EIDS[MAINNET] = 30101;
        LZ_EIDS[ARBITRUM] = 30110;
        LZ_EIDS[BASE] = 30184;
        LZ_EIDS[ARB_SEP] = 40231;
        LZ_EIDS[SEP] = 40161;
    }

    function currentSalt() public view returns (bytes32) {
        uint256 interval = 300; // 5 minutes in seconds
        uint256 saltBase = block.timestamp / interval;
        return keccak256(abi.encodePacked(saltBase));
    }
}
