pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tables/Proposals.sol";
import "base/Config.sol";

contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Senators senators = new Senators();
        if (block.chainid == SEP){
            address[] memory newSenators = new address[](3);
            newSenators[0] = 0x08B3e694caA2F1fcF8eF71095CED1326f3454B89;
            newSenators[1] = 0x80581C6e88Ce00095F85cdf24bB760f16d6eC0D6;
            newSenators[2] = 0x679d87D8640e66778c3419D164998E720D7495f6;
            senators.addSenators(newSenators);
        } else {
            address[] memory newSenators = new address[](10);
            newSenators[0] = 0xf2befa4b9489c1ef75e069d16a6f829f71b4b988; // frank
            newSenators[1] = 0x8687ab2ff3188f961828fc2131b6150ee97bedce; // kara
            newSenators[2] = 0x00127f44bad82b9ea27245a14a4141e5ef0161a8; // roy
            newSenators[3] = 0xb87b8c495d3dae468d4351621b69d2ec10e656fe; // alex
            newSenators[4] = 0x4CBf10c36b481d6afF063070E35b4F42E7Aad201; // engibob
            newSenators[5] = 0x529bd2351476ba114f9d60e71a020a9f0b99f047; // anastasia
            newSenators[6] = 0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801; // eiman
            newSenators[7] = 0x8a7fd7f4b1a77a606dfdd229c194b1f22de868ff; // daniel
            newSenators[8] = 0x86c779b3741e83A36A2a236780d436E4EC673Af4; // titan
            newSenators[9] = 0x08B3e694caA2F1fcF8eF71095CED1326f3454B89; // jade
            senators.addSenators(newSenators);
        }
        Proposals votes = new Proposals("Proposals", address(senators), 1, 1);
        vm.stopBroadcast();
    }
}

