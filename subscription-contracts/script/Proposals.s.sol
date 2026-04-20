pragma solidity ^0.8.20;

import "../src/tables/Proposals.sol";
import "base/Config.sol";

contract MyScript is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        // Optional: pass SENATORS_ADDRESS=0x... to reuse an existing Senators
        // registry. If unset (or zero), a new Senators is deployed and
        // bootstrapped with the per-chain default roster below.
        address existingSenators = vm.envOr("SENATORS_ADDRESS", address(0));

        vm.startBroadcast(deployerPrivateKey);

        Senators senators;
        if (existingSenators != address(0)) {
            senators = Senators(existingSenators);
            console.log("Reusing existing Senators at:", existingSenators);
        } else {
            senators = new Senators();
            console.log("Deployed new Senators at:", address(senators));

            if (block.chainid == SEP) {
                address[] memory newSenators = new address[](4);
                newSenators[0] = 0x08B3e694caA2F1fcF8eF71095CED1326f3454B89;
                newSenators[1] = 0x80581C6e88Ce00095F85cdf24bB760f16d6eC0D6;
                newSenators[2] = 0x679d87D8640e66778c3419D164998E720D7495f6;
                newSenators[3] = 0xAF6f2A7643A97b849bD9cf6d3f57e142c5BbB0DA;
                senators.addSenators(newSenators);
            } else {
                address[] memory newSenators = new address[](7);
                newSenators[0] = 0xf2Befa4B9489c1ef75E069D16A6F829F71B4B988; // frank
                newSenators[1] = 0x8687AB2FF3188F961828FC2131b6150Ee97Bedce; // kara
                newSenators[2] = 0xB87b8c495d3DAE468d4351621b69d2eC10E656FE; // alex
                newSenators[3] = 0x529Bd2351476ba114f9D60E71A020A9F0b99f047; // anastasia
                newSenators[4] = 0x8A7fD7F4B1A77A606DFdD229c194B1F22De868Ff; // daniel
                newSenators[5] = 0x08B3e694caA2F1fcF8eF71095CED1326f3454B89; // jade
                newSenators[6] = 0xE99cAD0078Dd4aC9cBEAddc0dacf6759aFD8fF43; // rina
                senators.addSenators(newSenators);
            }
        }

        Proposals votes = new Proposals("Proposals", address(senators));
        console.log("Deployed new Proposals at:", address(votes));
        console.log("Proposals.senators wired to:", address(senators));

        vm.stopBroadcast();
    }
}
