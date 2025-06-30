// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "std/Script.sol";
import "std/Test.sol";
import "std/StdJson.sol";

/// @notice Shared configuration between scripts
contract Config is Script {
    using stdJson for string;

    uint256 MAINNET = 1;
    uint256 ARBITRUM = 42161;
    uint256 BASE = 8453;
    uint256 BASE_SEP = 84532;
    uint256 ARB_SEP = 421614;
    uint256 SEP = 11155111;
    uint256 POLYGON = 137;
    uint256 OPT_SEP = 11155420;

    mapping(uint256 => address) public LZ_ENDPOINTS;
    mapping(uint256 => address) public POOL_MANAGERS;
    mapping(uint256 => address) public POSITION_MANAGERS;
    mapping(uint256 => address) public V4_ROUTERS;
    mapping(uint256 => address) public VMOONEY_ADDRESSES;
    mapping(uint256 => address) public MOONEY_ADDRESSES;
    mapping(uint256 => address) public VOTING_ESCROW_DEPOSITOR_ADDRESSES;
    mapping(uint256 => address) public FEE_HOOK_ADDRESSES;
    mapping(uint256 => address) public TEST_TOKEN_ADDRESSES;
    mapping(uint256 => uint32) public LZ_EIDS;
    mapping(uint256 => address) public CHAINLINK_ROUTERS;
    mapping(uint256 => bytes32) public CHAINLINK_DONS;
    mapping(uint256 => uint64) public CHAINLINK_SUBS;
    mapping(uint256 => uint24) public LP_FEE;
    mapping(uint256 => address) public MOONDAO_TEAM_ADDRESSES;
    mapping(uint256 => address) public MOONDAO_TREASURY_ADDRESSES;
    mapping(uint256 => address) public STARGATE_POOLS;
    // Juicebox contract addresses are shared across chains
    address constant JB_MULTI_TERMINAL = address(0xDB9644369c79C3633cDE70D2Df50d827D7dC7Dbc);
    address constant CREATE2_DEPLOYER = address(0x4e59b44847b379578588920cA78FbF26c0B4956C);
    address payable constant CROSS_CHAIN_PAY_ADDRESS = payable(address(0xb9Ce576bec5D36F89275eb9bE6C1057B3bD3572C));

    constructor() {
        string memory ethJson = vm.readFile("../contracts/deployments/ethereum.json");
        string memory arbJson = vm.readFile("../contracts/deployments/arbitrum.json");
        string memory baseJson = vm.readFile("../contracts/deployments/base.json");
        string memory sepJson = vm.readFile("../contracts/deployments/sepolia.json");
        string memory polygonJson = vm.readFile("../contracts/deployments/polygon.json");
        string memory arbSepJson = vm.readFile("../contracts/deployments/arbitrum-sepolia.json");

        MOONDAO_TREASURY_ADDRESSES[ARBITRUM] = 0xAF26a002d716508b7e375f1f620338442F5470c0;
        MOONDAO_TREASURY_ADDRESSES[SEP] = 0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b;

        MOONDAO_TEAM_ADDRESSES[ARBITRUM] = arbJson.readAddress(".MoonDAOTeam");
        MOONDAO_TEAM_ADDRESSES[SEP] = sepJson.readAddress(".MoonDAOTeam");

        // vMOONEY doesn't exist on arbitrum-sepolia
        VMOONEY_ADDRESSES[ARBITRUM] = arbJson.readAddress(".vMOONEYToken");
        VMOONEY_ADDRESSES[BASE] = baseJson.readAddress(".vMOONEYToken");
        VMOONEY_ADDRESSES[MAINNET] = ethJson.readAddress(".vMOONEYToken");
        VMOONEY_ADDRESSES[POLYGON] = polygonJson.readAddress(".vMOONEYToken");
        VMOONEY_ADDRESSES[SEP] = sepJson.readAddress(".vMOONEYToken");

        STARGATE_POOLS[SEP] = 0x9Cc7e185162Aa5D1425ee924D97a87A0a34A0706;
        STARGATE_POOLS[ARB_SEP] = 0x6fddB6270F6c71f31B62AE0260cfa8E2e2d186E0;
        STARGATE_POOLS[OPT_SEP] = 0xa31dCc5C71E25146b598bADA33E303627D7fC97e;


        LP_FEE[MAINNET] = 10000;
        LP_FEE[ARBITRUM] = 10000;
        LP_FEE[BASE] = 10000;
        LP_FEE[POLYGON] = 10000;
        // 50% on testnets to save gas
        LP_FEE[SEP] = 500000;
        LP_FEE[ARB_SEP] = 500000;

        // FIXME fund non-testnet subscriptions with LINK
        CHAINLINK_SUBS[MAINNET] = 107;
        CHAINLINK_SUBS[ARBITRUM] = 47;
        CHAINLINK_SUBS[BASE] = 56;
        CHAINLINK_SUBS[POLYGON] = 138;
        CHAINLINK_SUBS[ARB_SEP] = 363;
        CHAINLINK_SUBS[SEP] = 4723;

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
        LZ_ENDPOINTS[POLYGON] = 0x1a44076050125825900e736c501f859c50fE728c;
        LZ_ENDPOINTS[ARB_SEP] = 0x6EDCE65403992e310A62460808c4b910D972f10f;
        LZ_ENDPOINTS[SEP] = 0x6EDCE65403992e310A62460808c4b910D972f10f;

        LZ_EIDS[MAINNET] = 30101;
        LZ_EIDS[ARBITRUM] = 30110;
        LZ_EIDS[BASE] = 30184;
        LZ_EIDS[POLYGON] = 30109;
        LZ_EIDS[ARB_SEP] = 40231;
        LZ_EIDS[BASE_SEP] = 40245;
        LZ_EIDS[SEP] = 40161;
        LZ_EIDS[OPT_SEP] = 40232;

        POOL_MANAGERS[MAINNET] = 0x000000000004444c5dc75cB358380D2e3dE08A90;
        POOL_MANAGERS[ARBITRUM] = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
        POOL_MANAGERS[BASE] = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
        POOL_MANAGERS[POLYGON] = 0x67366782805870060151383F4BbFF9daB53e5cD6;
        POOL_MANAGERS[ARB_SEP] = 0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317;
        POOL_MANAGERS[SEP] = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

        POSITION_MANAGERS[MAINNET] = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
        POSITION_MANAGERS[ARBITRUM] = 0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869;
        POSITION_MANAGERS[BASE] = 0x7C5f5A4bBd8fD63184577525326123B519429bDc;
        POSITION_MANAGERS[POLYGON] = 0x1Ec2eBf4F37E7363FDfe3551602425af0B3ceef9;
        POSITION_MANAGERS[ARB_SEP] = 0xAc631556d3d4019C95769033B5E719dD77124BAc;
        POSITION_MANAGERS[SEP] = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;

        V4_ROUTERS[MAINNET] = 0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af;
        V4_ROUTERS[ARBITRUM] = 0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3;
        V4_ROUTERS[BASE] = 0x6fF5693b99212Da76ad316178A184AB56D299b43;
        V4_ROUTERS[POLYGON] = 0x1095692A6237d83C6a72F3F5eFEdb9A670C49223;
        V4_ROUTERS[ARB_SEP] = 0xeFd1D4bD4cf1e86Da286BB4CB1B8BcED9C10BA47;
        V4_ROUTERS[SEP] = 0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b;

        FEE_HOOK_ADDRESSES[ARBITRUM] = arbJson.readAddress(".FeeHook");
        FEE_HOOK_ADDRESSES[BASE] = baseJson.readAddress(".FeeHook");
        FEE_HOOK_ADDRESSES[ARB_SEP] = arbSepJson.readAddress(".FeeHook");
        FEE_HOOK_ADDRESSES[SEP] = sepJson.readAddress(".FeeHook");
        FEE_HOOK_ADDRESSES[ARBITRUM] = arbJson.readAddress(".FeeHook");

        TEST_TOKEN_ADDRESSES[ARB_SEP] = 0x53acb7A819A579436527B22eFbf4be81f24EfC33;
        TEST_TOKEN_ADDRESSES[SEP] = 0x1304c1e9F06D36abC99095829048E52793eD9362;

    }

    function currentSalt() public view returns (bytes32) {
        uint256 interval = 300; // 5 minutes in seconds
        uint256 saltBase = block.timestamp / interval;
        return keccak256(abi.encodePacked(saltBase));
    }
}
