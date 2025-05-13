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
    mapping(uint256 => address) public VMOONEY_ADDRESSES;
    mapping(uint256 => address) public MOONEY_ADDRESSES;
    mapping(uint256 => address) public VOTING_ESCROW_DEPOSITOR_ADDRESSES;
    mapping(uint256 => address) public FEE_HOOK_ADDRESSES;
    mapping(uint256 => address) public TEST_TOKEN_ADDRESSES;
    mapping(uint256 => uint32) public LZ_EIDS;

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

        MOONEY_ADDRESSES[ARBITRUM] = arbJson.readAddress(".MOONEYToken");
        MOONEY_ADDRESSES[BASE] = baseJson.readAddress(".MOONEYToken");
        MOONEY_ADDRESSES[MAINNET] = ethJson.readAddress(".MOONEYToken");
        MOONEY_ADDRESSES[POLYGON] = polygonJson.readAddress(".MOONEYToken");
        MOONEY_ADDRESSES[SEP] = sepJson.readAddress(".MOONEYToken");

        VOTING_ESCROW_DEPOSITOR_ADDRESSES[ARBITRUM] = arbJson.readAddress(".VotingEscrowDepositor");
        VOTING_ESCROW_DEPOSITOR_ADDRESSES[SEP] = sepJson.readAddress(".VotingEscrowDepositor");

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

        FEE_HOOK_ADDRESSES[ARB_SEP] = 0x049AA55919fCbfa37d1A220dCFF16b5fA9f60844;
        FEE_HOOK_ADDRESSES[SEP] = 0x45A0AA93f6972AA137086002527B2ECc1D1b8844;

        TEST_TOKEN_ADDRESSES[ARB_SEP] = 0xcA9b92A7F9FDabC52CBAED5e81F096490D20deDe;
        TEST_TOKEN_ADDRESSES[SEP] = 0x9B228F540f7245D7efd911043cC0315198CdDaf2;

        LZ_EIDS[MAINNET] = 30101;
        LZ_EIDS[ARBITRUM] = 30110;
        LZ_EIDS[BASE] = 30184;
        LZ_EIDS[ARB_SEP] = 40231;
        LZ_EIDS[SEP] = 40161;
    }
}
